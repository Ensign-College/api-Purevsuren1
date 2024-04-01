const Redis = require('redis');
const {addOrder, getOrder} = require("./orderservice.js");
const {addOrderItem} = require("./orderservice.js");
const fs = require("fs");
const Schema = JSON.parse(fs.readFileSync("./orderItemSchema.json"));
const Ajv = require('ajv');
const ajv = new Ajv();
const AWS = require('aws-sdk');

const redisClient = Redis.createClient({
    url:`redis://localhost:6379`
});

const lambda = new AWS.Lambda();

exports.boxesHandler = async (event, context) => {
  try {
      const getAsync = promisify(redisClient.json.get).bind(redisClient);
      const boxes = await getAsync('boxes');
      return {
          statusCode: 200,
          body: JSON.stringify(boxes[0])
      };
  } catch (error) {
      console.error(error);
      return {
          statusCode: 500,
          body: "Internal Server Error"
      };
  }
};

exports.ordersHandler = async (event, context) => {
  try {
      const order = JSON.parse(event.body);
      let responseStatus = order.productQuantity ? 200 : 400 && order.shippingAddress ? 200 : 400;

      if (responseStatus === 200) {
          try {
              await addOrder({ redisClient, order });
          } catch (error) {
              console.error(error);
              return {
                  statusCode: 500,
                  body: "Internal Server Error"
              };
          }
      }

      return {
          statusCode: responseStatus,
          body: responseStatus === 200 ? "" : `Missing one of the following fields: ${exactMatchOrderFields()} ${partiallyMatchOrderFields()}`
      };
  } catch (error) {
      console.error(error);
      return {
          statusCode: 400,
          body: "Invalid request body"
      };
  }
};

exports.orderItemsHandler = async (event, context) => {
  try {
      const validate = ajv.compile(Schema);
      const valid = validate(JSON.parse(event.body));
      if (!valid) {
          return {
              statusCode: 400,
              body: JSON.stringify({ error: "Invalid request body" })
          };
      }

      const orderItemId = await addOrderItem({ redisClient, orderItem: JSON.parse(event.body) });

      return {
          statusCode: 201,
          body: JSON.stringify({ orderItemId, message: "Order item added successfully" })
      };
  } catch (error) {
      console.error(error);
      return {
          statusCode: 500,
          body: "Internal Server Error"
      };
  }
};

exports.ordersByIdHandler = async (event, context) => {
  try {
      const orderId = event.pathParameters.orderId;
      const order = await getOrder({ redisClient, orderId });

      return {
          statusCode: 200,
          body: JSON.stringify(order)
      };
  } catch (error) {
      console.error(error);
      return {
          statusCode: 500,
          body: "Internal Server Error"
      };
  }
};

exports.paymentsHandler = async (event, context) => {
  try {
      const payments = [];

      const keys = await new Promise((resolve, reject) => {
          redisClient.keys("payments:*", (err, keys) => {
              if (err) {
                  console.log("This is an error" + err);
                  reject(err);
                  return;
              }
              resolve(keys);
          });
      });

      for (const key of keys) {
          const payment = await redisClient.json.get(key);
          payments.push(payment);
      }
      return {
          statusCode: 200,
          body: JSON.stringify(payments)
      };
  } catch (error) {
      console.error('Error retrieving payments:', error);
      return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal server error' })
      };
  }
};

exports.paymentByIdHandler = async (event, context) => {
  try {
      const { paymentId } = event.pathParameters;
      const paymentKey = `payments:${paymentId}`;
      const payment = await new Promise((resolve, reject) => {
          redisClient.json.get(paymentKey, (err, payment) => {
              if (err) {
                  console.error('Error from Redis:', err);
                  reject(err);
                  return;
              }
              resolve(payment);
          });
      });

      if (payment) {
          return {
              statusCode: 200,
              body: JSON.stringify(payment)
          };
      } else {
          return {
              statusCode: 404,
              body: JSON.stringify({ error: 'Payment not found' })
          };
      }
  } catch (error) {
      console.error('Error from Redis:', error);
      return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Error retrieving payment', message: error.message })
      };
  }
};

exports.postPaymentHandler = async (event, context) => {
  try {
      const {
          customerId, billingAddress, billingCity,
          billingState, billingZipCode, totalAmount, paymentId,
          cardId, cardType, last4digits, orderId
      } = JSON.parse(event.body);

      const payment = {
          customerId, billingAddress, billingCity,
          billingState, billingZipCode, totalAmount, paymentId,
          cardId, cardType, last4digits, orderId
      }

      const paymentKey = `payments:${customerId}-${Date.now().toString()}`;

      await redisClient.json.set(paymentKey, '.', payment);

      return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Payment successfully stored' })
      };
  } catch (error) {
      console.error('Error storing:', error);
      return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal server error' })
      };
  }
};
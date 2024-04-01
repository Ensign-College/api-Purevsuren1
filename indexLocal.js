const express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors');
const Redis = require('redis');
const redisClient = Redis.createClient({
    url: 'redis://localhost:6379'
});
const { addOrder, getOrder } = require("./orderservice.js"); //import the addOrder function from the orderservice.js file
const { addOrderItem, getOrderItem } = require("./orderItems.js"); // import the addOrderItem function from the orderItems.js file
const fs = require("fs"); // import the file system library
const Schema = JSON.parse(fs.readFileSync("./orderItemSchema.json", "utf8")); // read the orderItemSchema.json file and parse it as JSON
const Ajv = require("ajv"); // import the ajv library
const ajv = new Ajv(); // create an ajv object to validate JSON

redisClient.on('connect', () => {
    console.log('Connected to Redis');
    
});

redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
});
redisClient.on('end', () => {
    console.log('Connection to Redis closed. Attempting to reconnect..');
    // Implement logic to reconnect here
});

const options = {
    origin: 'http://localhost:3000'
};

const app = express();
app.use(bodyParser.json());
app.use(cors(options));

const port = 3001;
app.listen(port, () => {
    redisClient.connect();
    console.log(`API is listening on port: ${port}`);
});

app.get('/boxes', async (req, res, next) => {
    try {
        let boxes = await redisClient.json.get('boxes', { path: '$' });
        res.json(boxes[0]);
    } catch (error) {
        console.error('Error getting boxes from Redis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/boxes', async (req, res, next) => {
    try {
        const newBox = req.body;
        newBox.id = parseInt(await redisClient.json.arrLen('boxes', '$')) + 1;
        await redisClient.json.arrAppend('boxes', '$', newBox);
        res.json(newBox);
    } catch (error) {  // Remove 'cdnpm' from this line
        console.error('Error adding new box to Redis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post("/payments", async (req, res, next) => {
    try {
        const {
            customerId,
            billingAddress,
            billingCity,
            billingState,
            billingZipCode,
            totalAmount,
            paymentId,
            cardId,
            cardType,
            last4digits,
            orderId
        } = req.body;

        const payment = {
            customerId,
            billingAddress,
            billingCity,
            billingState,
            billingZipCode,
            totalAmount,
            paymentId,
            cardId,
            cardType,
            last4digits,
            orderId
        }

        const paymentKey = `payments:${customerId}-${Date.now().toString()}`

        // Wrap Redis operation in try-catch
        try {
            await redisClient.json.set(paymentKey, '.', payment);
            res.status(200).json({message: 'Payment successfully stored'});
        } catch (error) {
            console.error('Error storing payment:', error);
            res.status(500).json({ error: 'Internal server error', message: error.message });
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});
app.get("/payments", async (req, res, next) => {
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
        res.json(payments);
    } catch (error) {
        console.error('Error retrieving payments:', error);
        res.status(500).json({error: 'Internal server error'});
    }

})

app.get('/payments/:paymentId?', async (req, res) => {
    try {

        const {paymentId} = req.params;
        const paymentKey = `payments:${paymentId}`;
        const payment = await redisClient.json.get(paymentKey);
        if (payment) {
            res.json(payment);
        } else {
            res.status(404).json({error: 'Payment not found'});
        }
    } catch (error) {
        console.error('Error from Redis:', error);
        res.status(500).json({error: 'Error retrieving payments', message: error.message});
    }
}); 

//Order
app.post("/orders", async (req, res) => {
    let order = req.body; //get the order from the request body
  
    // order details, include product quantity and shipping address
    let responseStatus =
      order.productQuantity && order.ShippingAddress ? 200 : 400;
  
    if (responseStatus === 200) {
      try {
        // addOrder function to handle order creation in the database
        await addOrder({ redisClient, order });
        res
          .status(200)
          .json({ message: "Order created successfully", order: order });
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
        return;
      }
    } else {
      res.status(responseStatus);
      res.send(
        `Missing one of the following fields: ${
          order.productQuantity ? "" : "productQuantity"
        } ${order.ShippingAddress ? "" : "ShippingAddress"}`
      );
    }
    res.status(responseStatus).send();
  });
  
  //GET /orders/:orderId
  app.get("/orders/:orderId", async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const order = await getOrder({ redisClient, orderId });
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error getting order:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
//Order items
//ORDER ITEMS
app.post("/orderItems", async (req, res) => {
    try {
      console.log("Schema:", Schema);
      const validate = ajv.compile(Schema);
      const valid = validate(req.body);
      if (!valid) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      console.log("Request Body:", req.body);
  
      // Calling addOrderItem function and storing the result
      const orderItemId = await addOrderItem({
        redisClient,
        orderItem: req.body,
      });
  
      // Responding with the result
      res
        .status(201)
        .json({ orderItemId, message: "Order item added successfully" });
    } catch (error) {
      console.error("Error adding order item:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  app.get("/orderItems/:orderItemId", async (req, res) => {
    try {
      const orderItemId = req.params.orderItemId;
      const orderItem = await getOrderItem({ redisClient, orderItemId });
      res.json(orderItem);
    } catch (error) {
      console.error("Error getting order item:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

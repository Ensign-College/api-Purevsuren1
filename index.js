const express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors');
const Redis = require('redis');
const redisClient = Redis.createClient({
    url: 'redis://localhost:6379'
});

redisClient.on('connect', () => {
    console.log('Connected to Redis');
    // Read the JSON file and store it in Redis
    storeJsonInRedis();
});

redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
});
redisClient.on('end', () => {
    console.log('Connection to Redis closed. Attempting to reconnect...');
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

// app.post("/orders", async (req, res) => {
//     let order = req.body;
//     let responseStatus = order.productQuantity && order.ShippingAddress ?200 : 400;
// if(responseStatus === 200){
//     try{
//     await addOrder({redisClient, order});
//     }catch(error){
//         console.error(error);
//         res.status(500).send("internal server error");
//         return;
//     }
// }else{
//     res.status(responseStatus);
//     res.send('Missing one of the following fields: ${ order.productQuantity ? "" : "productQuantity" } ${order.ShippingAddress ? "" : "ShippingAddress"}
//     );
// }
// res.status(responseStatus).send();

// });
// app.get("/orders/:orderID", async(req, res) => {
// const orderId = req.param.orderId;
// let order = await getOrder({redisClient, orderId});
// if (order === null){
// res.status(404).send("order not found");

// }else{
// res.json(order);
// }

// });
// //Order items
// app.post("/orderItems", async (req, res)=> {
// try {
// console.log("Schema:", Schema);
// const validate = Ajv.compile(Schema);
// const valid = validate(req.body);
// if (!valid) {
// return res.status(400).json({error: "invalid request body"});
// }
// console.log("Request body", req.body);
// //calling addOrderOtem function and storing the result
// const orderItemId = await addOrderItem({
// redisClient,
//  orderItem: req.body,
// });
// //respond with result
// res
// .status(201)
// .json({orderItemId, message: "Order item added successfully"});

// }catch(error){
// console.error("error adding item", error);
// res.status(500).json({error: "internal server error"})
// }
// });

// app.get("/orderItems/:orderItemId", async (req, res) =>{
// try {
// const orderItemId = req.params.orderItemId;
// const orderItem = await getOrderItem({redisClient, orderItemId});
// res.json(orderItem);
// }catch(error){
// console.error("error getting ortder otem", error);
// res.status(500).json({error: "Internal server error"})
// }
// });

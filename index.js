const express = require("express");

const bodyParser = require("body-parser");

 const Redis = require('redis'); // import the Redis library

 const redisClient = Redis.createClient({
    url:`redis://localhost:6379`

 });


const app = express(); //create a express application
app.use(bodyParser.json());
const port = 3000;
app.listen(port, () =>{
    redisClient.connect(); //connects to REdis database
    console.log(`API is listening on port: ${port}`)//template literal
}); //listen fopr browser from the front end


//1 URL
//2 a function to return boxes
//3 req - request from the browser
//res - response to the browser

app.get('/boxes', (req, res, next)=>{
    let boxes = redisClient.json.get('boxes', {path:'$'}); //get boxes
    //send the boxes to browser
    res.send(JSON.stringify(boxes)) //convert boxes into a string
});//return boxes to the user

app.post('/boxes', async (req, res, next) => { //async means we will await promies
    
    const newBox = req.body; // Assuming you have body-parser middleware to parse JSON
    newBox.id=parseInt(await redisClient.json.arrLen('boxes', '$'))+1; //user should not choose the ID
    await redisClient.json.arrAppend('boxes', '$', newBox);
    // saves boxes to REdis
    res.json(newBox); //respond with the new box
});

 
console.log("hello")
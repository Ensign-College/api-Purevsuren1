const express = require("express");

 const Redis = require('redis'); // import the Redis library

 const redisClient = Redis.createClient({
    url:`redis://localhost:6379`

 });


const app = express(); //create a express application
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
});
 
console.log("hello")
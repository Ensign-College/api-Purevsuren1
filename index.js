const express = require("express");

const bodyParser = require("body-parser");
const cors = require('cors');
 const Redis = require('redis'); // import the Redis library

const options = { 
    origin:'http://localhost:3000'//allow call frontend to backend
}

 const redisClient = Redis.createClient({
    url:`redis://localhost:6379`

 });


const app = express(); //create a express application
app.use(bodyParser.json());
app.use(cors(options)); //allow call frontend to backend
const port = 3001;
app.listen(port, () =>{
    redisClient.connect(); //connects to REdis database
    console.log(`API is listening on port: ${port}`)//template literal
}); //listen fopr browser from the front end


//1 URL
//2 a function to return boxes
//3 req - request from the browser
//res - response to the browser

app.get('/boxes', async (req, res, next)=>{
    let boxes = await redisClient.json.get('boxes', {path:'$'}); //get boxes
    //send the boxes to browser
    res.json(boxes[0]); //boxes is array of arrays //convert boxes into a string
});//return boxes to the user

app.post('/boxes', async (req, res, next) => { //async means we will await promies
    
    const newBox = req.body; // Assuming you have body-parser middleware to parse JSON
    newBox.id=parseInt(await redisClient.json.arrLen('boxes', '$'))+1; //user should not choose the ID
    await redisClient.json.arrAppend('boxes', '$', newBox);
    // saves boxes to REdis
    res.json(newBox); //respond with the new box
});

 
console.log("hello")
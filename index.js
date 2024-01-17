const express = require("express")
const app = express();
 
const boxes = [
    {boxId:1},
    {boxId:2},
    {boxId:3},
    {boxId:4},
]
 
 
app.get("/", (req, res, next)=>{
    res.send("Hello World")
})
app.get("/boxes", (req, res, next)=>{
    res.send(JSON.stringify(boxes))
})
 
app.listen(4321,()=>{
    console.log("This is working")
})
 
 
console.log("hello")
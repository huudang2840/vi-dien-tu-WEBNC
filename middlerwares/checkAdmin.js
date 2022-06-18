module.exports = function checkAdmin(req ,res , next) {
    let username = req.session.username
    console.log(username)
    if(username === "admin"){
        next();
    }
    else{
        return res.send("Vô làm cái lon gì????")
    }
}

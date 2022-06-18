module.exports = {
    cookieSecret: "your cookie secret goes here",
    mongo: {
        development: {
            connectionString: 'mongodb+srv://huudang284:!23456@cluster0.yxl4h.mongodb.net/?retryWrites=true&w=majority',
        },
        production: {
            connectionString: 'your production_connection_string',
        },
    },
}

module.exports = {
    cookieSecret: "your cookie secret goes here",
    mongo: {
        development: {
            connectionString: 'mongodb://localhost:27017/ViDienTu',
        },
        production: {
            connectionString: 'your production_connection_string',
        },
    },
}
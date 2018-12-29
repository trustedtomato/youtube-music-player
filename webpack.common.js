const CleanWebpackPlugin = require('clean-webpack-plugin');

module.exports = {
    module: {
        rules: [{
            test: /\.worker\.js$/,
            use: { loader: 'worker-loader' }
        }]
    },
    plugins: [
        new CleanWebpackPlugin(['dist/*.js'])
    ]
};
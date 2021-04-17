require('dotenv').config()

const express = require('express');
const app = express();
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const logger = require('./logger.js').logger

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// default options
app.use(fileUpload());

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ORIGIN);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  next();
});

const routes = require('./routes/index');
routes(app); //register the route

const host = process.env.SERVER_HOST;
const port = process.env.SERVER_PORT;

app.listen(port, host, () => console.log(`listening on port ${host}:${port}`));

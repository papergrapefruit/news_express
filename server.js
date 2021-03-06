// Dependencies
var express = require("express");
var exphbs = require('express-handlebars');
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var uri = 'mongodb://heroku_5t1jgflk:1a5k4m7sc3ar3oiko3evj0o3m7@ds013475.mlab.com:13475/heroku_5t1jgflk';

// Requiring our Note and Article models
var Note = require("./models/note.js");
var Article = require("./models/article.js");
// Our scraping tools
var request = require("request");
var cheerio = require("cheerio");



// Set mongoose to leverage built in JavaScript ES6 Promises
mongoose.Promise = global.Promise;

mongoose.connect(uri);



// Initialize Express
var app = express();

app.engine('handlebars', exphbs({
  defaultLayout: 'main'
}));
app.set('view engine', 'handlebars');

app.get('/', function (req, res) {
  res.render('index');
});



// Use morgan and body parser with our app
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));

// Make public a static dir
app.use(express.static("public"));

// Database configuration with mongoose

// var promise = mongoose.connect('mongodb://heroku_5t1jgflk:1a5k4m7sc3ar3oiko3evj0o3m7@ds013475.mlab.com:13475/heroku_5t1jgflk', {
//   useMongoClient: true,
//   /* other options */
// });


// mongoose.connect("");mongodb://heroku_5t1jgflk:1a5k4m7sc3ar3oiko3evj0o3m7@ds013475.mlab.com:13475/heroku_5t1jgflk
var db = mongoose.connection;

// promise.then(function (db) {


// Show any mongoose errors
db.on("error", function (error) {
  console.log("Mongoose Error: ", error);
});

// Once logged in to the db through mongoose, log a success message
db.once("openUri", function () {
  console.log("Mongoose connection successful.");
});

// });

// Routes
// ======

// A GET request to scrape website
app.get("/scrape", function (req, res) {
  // First, we grab the body of the html with request
  var link = "http://www.theonion.com";
  request(link, function (error, response, html) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);

    // Now, we grab and do the following:
    $("article").find('.headline').each(function (i, element) {

      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.headline = $(this).children("a").text().trim();
      var relPath = $(element).children("a").attr("href");
      result.link = link + relPath;
      result.summary = $(this).parent('header').siblings('div.desc').text().trim();

      // Using our Article model, create a new entry
      // This effectively passes the result object to the entry (and the title and link)
      var entry = new Article(result);

      // Now, save that entry to the db
      entry.save(function (err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        // Or log the doc
        else {
          console.log(doc);
        }
      });

    });
  });
  // Tell the browser that we finished scraping the text
  res.redirect('/');
});

// This will get the articles we scraped from the mongoDB
app.get("/articles", function (req, res) {
  // Grab every doc in the Articles array
  Article.find({}, function (error, doc) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Or send the doc to the browser as a json object
    else {
      res.json(doc);
    }
  });
});

// Grab an article by it's ObjectId
app.get("/articles/:id", function (req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  Article.findOne({
      "_id": req.params.id
    })
    // ..and populate all of the notes associated with it
    .populate("note")
    // now, execute our query
    .exec(function (error, doc) {
      // Log any errors
      if (error) {
        console.log(error);
      }
      // Otherwise, send the doc to the browser as a json object
      else {
        res.json(doc);
      }
    });
});


// Create a new note or replace an existing note
app.post("/articles/:id", function (req, res) {
  // Create a new note and pass the req.body to the entry
  var newNote = new Note(req.body);

  // And save the new note the db
  newNote.save(function (error, doc) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Otherwise
    else {
      // Use the article id to find and update it's note
      Article.findOneAndUpdate({
          "_id": req.params.id
        }, {
          "note": doc._id
        })
        // Execute the above query
        .exec(function (err, doc) {
          // Log any errors
          if (err) {
            console.log(err);
          } else {
            // Or send the document to the browser
            res.send(doc);
          }
        });
    }
  });
});


// Listen on port 3000
var port = process.env.PORT || 3000;

app.listen(port, function () {
  console.log("App running on port!");
});
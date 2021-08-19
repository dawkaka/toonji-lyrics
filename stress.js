const loadtest = require('loadtest');
    const options = {
      url: 'http://localhost:5000',
      concurrency: 20,
      maxSeconds: 10
    };
     loadtest.loadTest(options, function(err,result){
       if(err) throw err
       console.log(result);
     });
     switch(app.get('env')){
       case 'development':        // compact, colorful dev logging
       app.use(require('morgan')(':method :url :status :res[content-length] - :response-time ms'));
         break;
       case 'production':        // module 'express-logger' supports daily log rotation
       app.use(require('express-logger')({
       path: __dirname + '/log/requests.log'}));
        break;
      }

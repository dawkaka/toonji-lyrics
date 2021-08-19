const cluster = require('cluster');

function startWoker() {
  const worker = cluster.fork();
  console.log(worker.id);
}
if(cluster.isMaster) {
  require('os').cpus().forEach(() => {
    startWoker()
  });
  // log any workers that disconnect; if a worker disconnects, it
  // should then exit, so we'll wait for the exit event to spawn
  // a new worker to replace it
  cluster.on('disconnect', function(worker){
  console.log('CLUSTER: Worker %d disconnected from the cluster.',
  worker.id);
  });
  // when a worker dies (exits), create a worker to replace it
cluster.on('exit', function(worker, code, signal){
  startWorker();
  });
} else {
// start our app on worker; see index.js
require('./index.js')();
}

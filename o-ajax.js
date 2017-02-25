var ajax={};
ajax.log = false;
ajax.reader = function(){
  var ret = {};
  ret.buffers = [];
  ret.length = 0;
  ret.write = function(buffer){
    this.buffers.push(buffer);
    this.length += buffer.length;
    return this.length;
  }
  
  ret.read = function(){
    var p = 0;
    var buffer = new Buffer(this.length);
    for(var i=0; i<this.buffers.length; i++){
      var chunk = this.buffers[i];
      chunk.copy(buffer, p);
      p+=chunk.length;
    }
    return buffer;
  }
  return ret;
};

ajax.go = function(method, url, body, headers){
  var me = this;
  return new Promise(function (resolve, reject) {
    var URL = require('url');
    var uri = URL.parse(url);
    var ret = {data: null, error:null, code: 0, headers: null};
    if(me.log){
      console.log("\x1B[96m%s\x1B[39m: %s", method.toUpperCase(), url);
    }

    if((!uri)||(!uri.protocol)){
      resolve(ret);
      return;
    }
    var http = require(uri.protocol.replace(':','')) || require('http');
    var ua = 'Mozilla/5.0 (' + process.platform + '/' + process.arch +  ' node/' + process.version + ' o-ajax/1.0)';
    var opt = { 
      method: method,
      hostname: uri.hostname,
      port: uri.port, 
      path: uri.path
    };

    opt.headers = {};
    opt.headers["User-Agent"] = ua;
    opt.headers["Connection"]="close";  
    for(var key in headers){
      opt.headers[key]= headers[key];  
    }
    switch(method){
      case "get":{
        break;
      }
      case "post" :{
        if(!opt.headers["Content-Type"]){
          opt.headers["Content-Type"] = 'application/x-www-form-urlencoded';
        }
        opt.headers["Content-Length"] = body.length;
        break;    
      }
    }
    
    var tick = 0;
    var timer = null;
    
    var client = http.request(opt, function(msg) {
      var reader = me.reader();
      var received = 0;

      var len = msg.headers["content-length"];
      if(len){
        len = (global.parseInt(len)/1024).toFixed(2);
      }
      else {
        len = -1;
      }

      msg.on('data', function (chunk) {
        tick = 0;
        reader.write(chunk);
        received += chunk.length;
        if(me.log){
          console.log("[OnData]: Received=" + (received/1024).toFixed(2) + "K/" + len + "K");
        }
      });
      msg.on('end', function(){
        var len = msg.headers["content-length"];
        if(len){
          len = global.parseInt(len);
        }
        else {
          len = -1;
        }
        global.clearInterval(timer);
        timer = null;
        if((msg.statusCode==200) && (len>0) && (received<len)){
          console.log("[OnEnd]: Download Failed.");
          ret.error = "Download Failed";
          ret.headers = msg.headers;
          resolve(ret);
          return;
        }    
        var ce = msg.headers["content-encoding"];
        if(ce=="gzip"){
          var zlib = require('zlib');
          zlib.gunzip((reader.read()||""), function (err, decoded) {
            ret.data = decoded;
            ret.code = msg.statusCode;
            ret.headers = msg.headers;
            resolve(ret);
          });
        }
        else{
          ret.data = reader.read()||"";
          ret.code = msg.statusCode;
          ret.headers = msg.headers;
          resolve(ret);
        }
        if(me.log){
          console.log("[OnEnd]: Status=" + msg.statusCode);
        }
      });
      msg.on('error', function(error){
        ret.data = null;
        ret.error = error;
        ret.code = msg.statusCode;
        ret.headers = msg.headers;
        resolve(ret);
      });    
    });
    client.on('error', function(e){
      global.clearInterval(timer);      
      ret.data = null;
      ret.error = e;
      ret.code = 0;
      ret.headers = null;
      resolve(ret);
    });
    
    timer = global.setInterval(function(){
      tick ++;
      if(tick>120){
        global.clearInterval(timer);
        timer = null;
        client.abort();
        ret.data = null;
        ret.error = "time-out";
        ret.code = 0;
        ret.headers = null;
        resolve(ret);
      }
    }, 1000);
    
    client.write(body);
    client.end();
  });  
}

ajax.get = async function(url, headers){
  return await this.go("get", url, "", headers);
}

ajax.post = async function(url, body,  headers){
  return await this.go("post", url, body, headers);
}

module.exports = ajax;

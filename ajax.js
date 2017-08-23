const ajax={};
ajax.log = false;
ajax.modules = {http: require("http"), https: require("https")};
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

ajax.go = function(method, url, body, headers, proxy){
  var me = this;
  return new Promise(function (resolve, reject) {
    var URL = require('url');
    var uri = URL.parse(url);
    var ret = {data: "", text:"", error:null, code: 0, headers: null};
    if(me.log){
      console.log("\x1B[96m%s\x1B[39m: %s", method.toUpperCase(), url);
    }

    if((!uri)||(!uri.protocol)){
      resolve(ret);
      return;
    }
    var protocol = proxy ? "http" : ( uri.protocol.replace(':','') || 'http');
    var http = me.modules[protocol];
    var ua = 'Mozilla/5.0 (' + process.platform + '/' + process.arch +  ' node/' + process.version + ' o-ajax/1.0)';
    var opt = { 
      method: method,
      hostname: uri.hostname,
      port: uri.port, 
      path: uri.path
    };
    
    if(proxy){
      var mc = (proxy||"").match(/([^:]*):([\d]{1,5})/);
      var p = {hostname:"", port: 0};
      if(mc){
        p.hostname = mc[1];
        p.port = parseInt(mc[2]);
      }
      else {
        ret.error="BAD-PROXY";
        resolve(ret);
        return;
      }    

      opt.hostname = p.hostname;
      opt.port = p.port; 
      opt.path = url;
    }

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
        console.log(opt);
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
          process.stdout.write("[OnData]: Received=" + (received/1024).toFixed(2) + "K/" + len + "K  \r");
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
          console.log("\n[OnEnd]: Download Failed.");
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
            ret.text = ret.data.toString();
            ret.code = msg.statusCode;
            ret.headers = msg.headers;
            resolve(ret);
          });
        }
        else{
          ret.data = reader.read()||"";
          ret.text = ret.data.toString();
          ret.code = msg.statusCode;
          ret.headers = msg.headers;
          resolve(ret);
        }
        if(me.log){
          console.log("\n[OnEnd]: Status=" + msg.statusCode);
        }
      });
      msg.on('error', function(error){
        ret.data = "";
        ret.error = error;
        ret.code = msg.statusCode;
        ret.headers = msg.headers;
        resolve(ret);
      });    
    });
    client.on('error', function(e){
      global.clearInterval(timer);      
      ret.data = "";
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
        ret.data = "";
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

ajax.get = async function(url, headers, proxy){
  return await this.go("get", url, "", headers, proxy);
}

ajax.post = async function(url, body,  headers, proxy){
  return await this.go("post", url, body, headers, proxy);
}

module.exports = ajax;

# o-ajax
ajax for node.js

# Install
> npm install o-ajax

# DEMO

normal
```javascript
var ajax = require('o-ajax');
+async function(){
  var o = await ajax.get("https://www.bimwook.com/woo/about.do");
  if(!o.error){
    console.log(o.data.toString());
  }
  else {
    console.log(o.error);
  }
}();
```

POST:
```javascript
var ajax = require('o-ajax');
+async function(){
  var body = [];
  body.push("u=bamboo");
  body.push("p=******");
  var o = await ajax.post("https://www.bimwook.com/woo/ajax.do", body.join("&"));
  if(!o.error){
    console.log(o.data.toString());
  }
  else {
    console.log(o.error);
  }
}();
```

The return object:
```javascript
{
  data:[Buffer]
  error: [error]
  code: [int]
  headers: [object]
}
```
That's All.

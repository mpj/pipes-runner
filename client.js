var pipes      = require('./pipes');
var $          = require('jquery-browserify');
var Handlebars = require('handlebars');
var esprima    = require('esprima');

var client = new Faye.Client('http://localhost:8000/');
var source   = $("#main-template").html();
var template = Handlebars.compile(source);

var createViewmodel = require('./timeline-view-model');

var currentViewModel;

function onBody(body) {


  $(".main-template-target").html('Running...')

  var module;
  try {
    esprima.parse('('+body+')');
    module = eval('('+body+')')
  } catch(e) {
    $(".main-template-target").html("Error evaluating module<br />"+ e.message)
    return
  }

  console.log("Module was parsed:",module)

  var whenTimeline;

  try {
    whenTimeline = pipes.module(module).runWorld((module.worlds && module.worlds[0]) || {})
  } catch(e) {
    var findFunctionName = e.stack.match(/at\s(.+)\s\(eval/)
    var functionName =  findFunctionName && findFunctionName[1]
    var findLineNumber = e.stack.match(/\d+:\d+\),.+:(\d):\d+\)/)
    var lineNumber = findLineNumber && findLineNumber[1]
    $(".main-template-target").html("Error running module<br />"+ e.message + " (on line " + lineNumber + " in module - in transform <strong>" + functionName + '</strong>)')
    return
  }
  whenTimeline.then(function(timeline) {
    if(currentViewModel)
      currentViewModel.onChange = null;
    currentViewModel = createViewmodel(timeline)

    function render() {
      $(".main-template-target").html(template(currentViewModel))
    }
    render()
    currentViewModel.onChange = render
  })
  .done()
}



$(document).ready(function() {
  $.ajax({ type: 'GET', url: '/body', complete: function(response) {
    console.log("response", response)
    if (response.status === 200)
      onBody(response.responseText)
  }});
  client.subscribe('/body', onBody);
  $(document).keydown(function(e){
    if (e.keyCode === 40) currentViewModel.arrowDown();
    if (e.keyCode === 38) currentViewModel.arrowUp();
  });
})

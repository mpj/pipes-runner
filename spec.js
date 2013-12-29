var chai = require('chai')
chai.Assertion.includeStack = true;
var Q = require('q')
chai.should()

var Runner = require('./runner.js')





var runner = Object.create(Runner)

runner.run({
  transforms: [
    function add(work) {
      work.done({
        result: work.message.a + work.message.b
      })
    },
    function add_five_and_seven(work) {
      work.done('add', { a: 5, b: 7 })
    }
  ],
  routes: [{
    channel: 'start',
    transform: 'add_five_and_seven'
  }],
  worlds: [{
    label: 'Playground',
    interceptors: [{
      channel: 'add successful',
      expect: {
        result: 7
      }
    }]
  }]
}).then(function(result) {
  var timeline = result.timelines[0]
  timeline.world.label.should.equal('Playground')
  var e = timeline.events

  e[0].sent.channel.should.equal('start')
  e[0].sent.message.should.equal(true)

  e[1].received.channel.should.equal('start')
  e[1].received.message.should.equal(true)
  e[1].transform.should.equal('add_five_and_seven')
  e[1].sent.channel.should.equal('add')
  e[1].sent.message.a.should.equal(5)
  e[1].sent.message.b.should.equal(7)

})

.then(function() {
  return runner.run({
    transforms: {
      add: function(work) {
        work.done({
          result: work.message.a + work.message.b
        })
      }
    },
    worlds: [{
      label: 'Staging',
      interceptors: [{
        channel: 'add successful',
        expect: {
          result: 7
        }
      }]
    }]
  })
}).then(function(result) {
  var timeline = result.timelines[0]
  timeline.world.label.should.equal('Staging')
  timeline.events[0].sent.channel.should.equal('start')
  timeline.events[0].sent.message.should.equal(true)

}).done(function() {
  console.log("All is well.")
})




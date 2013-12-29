var chai = require('chai')
chai.Assertion.includeStack = true;
var Q = require('q')
chai.should()


// TODO: Support for multiple expectations on one channel
// TODO: Support deepEquals for arrays
// TODO: Support combining routes
// TODO: Implement foreigners

var Runner = require('./runner.js')

var runner = Object.create(Runner)

var World = {
  expectations: [],
  expectation: function(e) { this.expectations.push(e); return this }
}

var Module = {
  routes: [],
  transforms: [],
  worlds: [],
  world:     function(w) { this.worlds    .push(w); return this },
  transform: function(t) { this.transforms.push(t); return this },
  route:     function(r) { this.routes    .push(r); return this }
}


var module =
  Object.create(Module)
    .route({
      channel: 'start',
      transform: 'add_five_and_seven'
    })
    .transform(function add_five_and_seven(work) {
      work.done('add', { a: 5, b: 7 })
    })
    .transform(function add(work) {
      work.done('add_success', {
        result: work.message.a + work.message.b
      })
    })
    .world({
      label: 'Playground',
      expectations: [{
        channel: 'add_success',
        message: {
          result: 12
        }
      }]
    })
    .world({
      label: 'Test failure',
      expectations: [{
        channel: 'add_success',
        message: {
          result: 13 // <- not 12!
        }
      }]
    })




runner.run(module).then(function(result) {
  console.log("result is", JSON.stringify(result, null, 2))
  var timeline = result.timelines[0]
  timeline.world.label.should.equal('Playground')
  var e = timeline.events

  e[0].received.channel.should.equal('start')
  e[0].received.message.should.equal(true)
  e[0].transform.should.equal('add_five_and_seven')
  e[0].sent.channel.should.equal('add')
  e[0].sent.message.a.should.equal(5)
  e[0].sent.message.b.should.equal(7)

  // There is no explicit route for add, but
  // if channel name matches perfectly, the message is routed
  // to the transform with the same name
  e[1].received.channel.should.equal('add')
  e[1].received.message.a.should.equal(5)
  e[1].received.message.b.should.equal(7)
  e[1].transform.should.equal('add')
  e[1].sent.channel.should.equal('add_success')
  e[1].sent.message.result.should.equal(12)

  // Success expectation
  e[2].received.channel.should.equal('add_success')
  e[2].received.message.result.should.equal(12)
  e[2].expectation.message.result.should.equal(12)
  e[2].expectation.match.should.equal(true)

  timeline = result.timelines[1]
  timeline.world.label.should.equal('Test failure')
  e = timeline.events

  e[2].expectation.message.result.should.equal(13)
  e[2].expectation.match.should.equal(false)

})
/*
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

})*/.done(function() {
  console.log("All is well.")
})




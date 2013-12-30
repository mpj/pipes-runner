var chai = require('chai')
chai.Assertion.includeStack = true;
var Q = require('q')
chai.should()

// Mark I
// TODO: Module names
// TODO: Fluent syntax on worlds
// TODO: Support deepEquals for arrays
// TODO: Support combining routes
// TODO: Implement foreigners
// TODO: Expectations should be a able to send



// Mark II+
// TODO: Submodules
// TODO: Run single world

var pipes = require('./pipes')

var addingModule = pipes.module()
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


pipes.run(Object.create(addingModule)
  .world({
    label: 'Playground',
    expectations: [{
      channel: 'add_success',
      message: {
        result: 12
      }
    }]
  })
).then(function(result) {
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

}).done(function() {
  console.log("All is well")
})

pipes.run(Object.create(addingModule)
  .world({
    label: 'Test failure',
    expectations: [{
      channel: 'add_success',
      message: {
        result: 13 // <- not 12!
      }
    }]
  })
).then(function(result) {
  var timeline = result.timelines[0]
  var e = timeline.events
  timeline.world.label.should.equal('Test failure')

  console.log(JSON.stringify(result,null,2))
  e[2].expectation.message.result.should.equal(13)
  e[2].expectation.match.should.equal(false)

}).done(function() {
  console.log("All is well.")
})

// TODO: Support for multiple expectations on one channel

pipes.run(pipes.module()
  .route({
    channel: 'start',
    transform: 'add_five_and_seven'
  })
  .route({
    channel: 'start',
    transform: 'add_five_and_eight'
  })
  .transform(function add_five_and_seven(work) {
    work.done('add', { a: 5, b: 7 })
  })
  .transform(function add_five_and_eight(work) {
    work.done('add', { a: 5, b: 8 })
  })
  .transform(function add(work) {
    work.done('add_success', {
      result: work.message.a + work.message.b
    })
  })
  .world({
    label: 'Dual expectations',
    expectations: [
    {
      channel: 'add_success',
      message: {
        result: 12
      }
    },{
      channel: 'add_success',
      message: {
        result: 13
      }
    }]
  })
).then(function(result) {
  //console.log(JSON.stringify(result,null,2))
  var timeline = result.timelines[0]
  var e = timeline.events
  timeline.world.label.should.equal('Dual expectations')

  e[2].received.message.result.should.equal(12)

  e[2].expectation.match.should.equal(true)

  e[5].received.message.result.should.equal(13)
  e[5].expectation.match.should.equal(true)

}).done(function() {
  console.log("All is well.")
})
var chai = require('chai')
chai.Assertion.includeStack = true;
var Q = require('q')
chai.should()
var expect = chai.expect
// Mark I

// TODO: Support deepEquals for arrays (deepMatch instead?)
// TODO: Support combining routes
// TODO: Implement foreigners
// TODO: Expectations should be a able to send

// Mark II+
// TODO: Submodules
// TODO: Run single world

// Maybe / Ideas
// TODO: Mark as unrouted
// Module names
// Not happy with world syntax - perhaps they should
// be more separate from the module in this context?
// They are testing the module from the outside, so they
// don't really need to be part of the module, they just
// need to be stored alongside. Like a module comes with
// docs, it comes with a world. A game is a package,
// manual and a dvd.
// TODO: Simulate time automatically

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
  .world(pipes.world('Playground')
    .expectation({
      channel: 'add_success',
      message: {
        result: 12
      }
    })
)).then(function(result) {
  var timeline = result.timelines[0]
  timeline.world.name.should.equal('Playground')
  var e = timeline.events

  e[0].received.channel.should.equal('start')
  e[0].received.message.should.equal(true)
  e[0].transform.name.should.equal('add_five_and_seven')
  e[0].sent.channel.should.equal('add')
  e[0].sent.message.a.should.equal(5)
  e[0].sent.message.b.should.equal(7)

  // There is no explicit route for add, but
  // if channel name matches perfectly, the message is routed
  // to the transform with the same name
  e[1].received.channel.should.equal('add')
  e[1].received.message.a.should.equal(5)
  e[1].received.message.b.should.equal(7)
  e[1].transform.name.should.equal('add')
  e[1].sent.channel.should.equal('add_success')
  e[1].sent.message.result.should.equal(12)

  // Success expectation
  e[2].received.channel.should.equal('add_success')
  e[2].received.message.result.should.equal(12)
  e[2].expectation.message.result.should.equal(12)

}).done(function() {
  console.log("All is well")
})

pipes.run(Object.create(addingModule)
  .world(pipes.world('Test failure')
    .expectation({
      channel: 'add_success',
      message: {
        result: 13 // <- not 12!
      }
    })
  )
).then(function(result) {
  var timeline = result.timelines[0]
  var e = timeline.events
  timeline.world.name.should.equal('Test failure')

  //console.log(JSON.stringify(result,null,2))
  timeline.unmet[0].message.result.should.equal(13)

}).done(function() {
  console.log("All is well.")
})


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
  .world(pipes.world('Dual expectations')
    .expectation({
      channel: 'add_success',
      message: {
        result: 12
      }
    })
    .expectation({
      channel: 'add_success',
      message: {
        result: 13
      }
    })
  )
).then(function(result) {
  //console.log(JSON.stringify(result,null,2))
  var timeline = result.timelines[0]
  var e = timeline.events
  timeline.world.name.should.equal('Dual expectations')

  e[2].received.message.result.should.equal(12)
  e[5].received.message.result.should.equal(13)

}).done(function() {
  console.log("All is well.")
})



pipes.run(pipes.module()
  .route({
    channel: 'start',
    transform: 'add_five_and_seven'
  })
  .route({
    channel: 'start',
    transform: 'add_five_and_nine'
  })
  .transform(function add_five_and_seven(work) {
    work.done('add', { a: 5, b: 7 })
  })
  .transform(function add_five_and_nine(work) {
    work.done('add', { a: 5, b: 9 })
  })
  .transform(function add(work) {
    work.done('add_success', {
      result: work.message.a + work.message.b
    })
  })
  .world(pipes.world('Dual expectations')
    .expectation({
      channel: 'add_success',
      message: {
        result: 12
      }
    })
    .expectation({
      channel: 'add_success',
      message: {
        result: 13
      }
    })
  )
).then(function(result) {
  //console.log(JSON.stringify(result,null,2))
  var timeline = result.timelines[0]
  var e = timeline.events
  timeline.world.name.should.equal('Dual expectations')

  timeline.unmet.length.should.equal(1)
  timeline.unmet[0].channel.should.equal('add_success')
  timeline.unmet[0].message.result.should.equal(13)

}).done(function() {
  console.log("All is well.")
})

// Takes too long to execute
pipes.run(pipes.module()
  .route({
    channel: 'start',
    transform: 'long_running'
  })
  .transform(function long_running(work) {
    setTimeout(function() {
      work.done('long_running_success', true)
    }, 2010)
  })
  .world(pipes.world('Handles timeouts')
    .expectation({
      channel: 'long_running_success',
      message: true
    })
  )
).then(function(result) {
  console.log(JSON.stringify(result,null,2))
  var e = result.timelines[0].events
  e[0].received.channel.should.equal('start')
  e[0].transform.should.equal('long_running')
  expect(e[0].sent).to.be.undefined
  e[0].timedOut.should.be.true
  return result
})
.delay(10)
.then(function(result) {
  result.timelines[0].events.length.should.equal(1)
  result.timelines[0].unmet[0].channel.should.equal('long_running_success')
})
.done(function() {
  console.log("All is well.")
})


pipes.run(pipes.module()
  .route({
    channel: 'start',
    transform: 'this_transform_does_not_exist'
  })
  .world(pipes.world('Empty world'))
).then(function(result) {
  var firstEvent = result.timelines[0].events[0]
  firstEvent.received.channel.should.equal('start')
  firstEvent.transform.name.should.equal('this_transform_does_not_exist')
  firstEvent.transform.notFound.should.equal.true

}).done(function() {
  console.log("All is well.")
})

// TODO: One expectation succeeds, but one fails (wrong message)
var chai = require('chai')
chai.Assertion.includeStack = true;
var Q = require('q')
chai.should()
var expect = chai.expect;


// Mark I
// TODO: Support combining routes
// TODO: Implement foreigners
// TODO: Message optional for expectations
// TODO: Intial message should show event

// TODO: Validate that route has a delivery and a transform
// TODO: validate delivieries

// Mark II+ and later
// * lastChange route (property)
// * Submodules
// * Figure out better names for almost everything
// * Implcitly send true as message

// Maybe / Ideas
// * Modules are a shitty name because of npm and commonjs
// TODO: refactor to simple json structure instead
// TODO: function to merge modules
// TODO: validate world
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

pipes.module({})
  .runWorld({ name: 'Empty world' })
  .then(function(timeline) {
    timeline.events.length.should.equal(0)
    timeline.unhandled[0][0].should.equal('start')
    timeline.unhandled[0][1].should.equal(true)
  }).done(function() {
    console.log("All is well.")
  })

var addingModule = {
  transforms: [
    function add(work) {
      work.done('add_success', {
        result: work.message.a + work.message.b
      })
    }
  ]
}

pipes.module(pipes.extend(addingModule, {
  routes: [{
    delivery: ['start'],
    transform: 'add_five_and_seven'
  }],
  transforms: [
    function add_five_and_seven(work) {
      work.done('add', { a: 5, b: 7 })
    }
  ]
})).runWorld({
  name: 'Playground',
  expectations: [{
    delivery: [ 'add_success', { result: 12 } ]
  }]
}).then(function(timeline) {
  timeline.world.name.should.equal('Playground')
  var e = timeline.events

  e[0].received.should.deep.equal(['start', true])
  e[0].transform.name.should.equal('add_five_and_seven')
  e[0].sent.should.deep.equal(['add', { a: 5, b: 7 }])

  // There is no explicit route for add, but
  // if channel name matches perfectly, the message is routed
  // to the transform with the same name
  e[1].received.should.deep.equal(['add', { a: 5, b: 7}])

  e[1].transform.name.should.equal('add')
  e[1].sent.should.deep.equal(['add_success', { result: 12 }])

  // Success expectation
  e[2].received.should.deep.equal(['add_success', { result: 12 }])
  e[2].transform.name.should.equal('expect')

}).done(function() {
  console.log("All is well")
})

pipes.module(pipes.extend(addingModule, {
  routes: [{
    delivery: [ 'start' ],
    transform: 'add_five_and_seven'
  }]
})).runWorld({
  name: 'Test failure',
  expectations: [{
    delivery: ['add_success', {
      result: 13 // <- not 12!
    }]
  }]
}).then(function(timeline) {
  var e = timeline.events
  timeline.world.name.should.equal('Test failure')

  timeline.unmet[0].delivery[1].result.should.equal(13)

}).done(function() {
  console.log("All is well.")
})


pipes.module(pipes.extend(addingModule, {
  routes: [{
    delivery: ['start'],
    transform: 'add_five_and_seven'
  },{
    delivery: ['start'],
    transform: 'add_five_and_eight'
  }],
  transforms: [
    function add_five_and_seven(work) {
      work.done('add', { a: 5, b: 7 })
    },
    function add_five_and_eight(work) {
      work.done('add', { a: 5, b: 8 })
    }
  ]
})).runWorld({
  name: 'Dual expectations',
  expectations: [
    {
      delivery: [ 'add_success', {
        result: 12
      }]
    },{
      delivery: [ 'add_success', {
        result: 13
      }]
    }
  ]
}).then(function(timeline) {
  var e = timeline.events
  timeline.world.name.should.equal('Dual expectations')

  e[2].received.should.deep.equal(['add_success', { result: 12 } ])
  e[5].received.should.deep.equal(['add_success', { result: 13 } ])

}).done(function() {
  console.log("All is well.")
})




pipes.module(pipes.extend(addingModule, {
  routes: [{
    delivery: ['start'],
    transform: 'add_five_and_seven'
  }, {
    delivery: ['start'],
    transform: 'add_five_and_nine'
  }],
  transforms: [
    function add_five_and_seven(work) {
      work.done('add', { a: 5, b: 7 })
    },
    function add_five_and_nine(work) {
      work.done('add', { a: 5, b: 9 })
    }
  ]
}))
.runWorld({
  name: 'Dual expectations',
  expectations: [{
    delivery: ['add_success', {
      result: 12
    }]
  }, {
    delivery: ['add_success', {
      result: 13
    }]
  }]
}).then(function(timeline) {
  var e = timeline.events
  timeline.world.name.should.equal('Dual expectations')

  timeline.unmet.length.should.equal(1)
  timeline.unmet[0].delivery[0].should.equal('add_success')
  timeline.unmet[0].delivery[1].result.should.equal(13)

}).done(function() {
  console.log("All is well.")
})

// Takes too long to execute

pipes.module({
  routes: [{
    delivery: ['start'],
    transform: 'long_running'
  }],
  transforms: [function long_running(work) {
    setTimeout(function() {
      work.done('long_running_success', true)
    }, 2010)
  }]
})
.runWorld({
  name: 'Handles timeouts',
  expectations: [{
    delivery: [ 'long_running_success', true ]
  }]
})
.then(function(timeline) {
  var e = timeline.events
  e[0].received.should.deep.equal(['start', true])
  e[0].transform.name.should.equal('long_running')
  expect(e[0].sent).to.be.undefined
  e[0].error.timedOut.should.be.true
  return timeline
})
.delay(10)
.then(function(timeline) {
  timeline.events.length.should.equal(1)
  timeline.unmet[0].delivery.should.deep.equal(['long_running_success', true])
})
.done(function() {
  console.log("All is well.")
})

// NEVER executes
var executed = false
pipes.module({
  routes: [{
    delivery: ['start'],
    transform: 'superlazy'
  }],
  transforms: [function superlazy(work) {
    // I'm doing nuthin!
  }]
})
.runWorld({
  name: 'Handles timeouts',
  expectations: [{
    delivery: [ 'long_running_success', true ]
  }]
})
.then(function(timeline) {
  executed = true
  var e = timeline.events
  e[0].received.should.deep.equal(['start', true])
  e[0].transform.name.should.equal('superlazy')
  expect(e[0].sent).to.be.undefined
  e[0].error.timedOut.should.be.true
})
.timeout(2100)
.done(function() {
  console.log("All is well!!!")
})


pipes.module({
  routes: [{
    delivery: ['start'],
    transform: 'this_transform_does_not_exist'
  }]
}).runWorld({})
.then(function(timeline) {
  var firstEvent = timeline.events[0]
  firstEvent.received.should.deep.equal([ 'start', true])
  firstEvent.transform.name.should.equal('this_transform_does_not_exist')
  firstEvent.error.notFound.should.equal.true

}).done(function() {
  console.log("All is well.")
})

pipes.module({})
.runWorld({
  name: 'Empty world',
  expectations: [{
    delivery: [ 'start', true ],
    send: [ 'test_channel', 'test_message' ]
  },{
    delivery: [ 'test_channel', 'test_message' ]
  }]
}).then(function(timeline) {
  var events = timeline.events
  events[0].received.should.deep.equal([ 'start', true ])
  events[0].transform.name.should.equal('expect')
  events[0].sent.should.deep.equal(['test_channel', 'test_message'])
  events[1].received.should.deep.equal([ 'test_channel', 'test_message' ])
  events[1].transform.name.should.equal('expect')
}).done(function() {
  console.log("All is well here.")
})


pipes.module({}).runWorld({
  name: 'Test arrays in expectation comparisions',
  expectations: [{
    delivery: [ 'start', true ],
    send: ['test_channel', [ { property: 1 }, 2  ] ]
  },{
    delivery: [ 'test_channel', [ { property: 1 }, 2 ] ],
    send: ['success', true ]
  }]
}).then(function(timeline) {
  timeline.unmet.length.should.equal(0)
  var e = timeline.events
  e[0].sent.should.deep.equal(['test_channel', [ { property: 1 }, 2  ] ])
  e[1].received.should.deep.equal(['test_channel', [ { property: 1 }, 2  ] ])
  e[1].transform.name.should.equal('expect')
  e[1].sent.should.deep.equal(['success', true])

}).done(function() {
  console.log("all is well")
})

pipes.module({}).runWorld({
  name: 'Test array ORDER in expectation comparisions',
  expectations: [{
    delivery: [ 'start', true ],
    send: [ 'test_channel', [ { property: 1 }, 2 ] ]
  },{
    delivery: [ 'test_channel', [ 2, { property: 1 }] ], // Should fail!
    send: [ 'success', true ]
  }]
}).then(function(timeline) {
  timeline.events.length.should.equal(1)
  timeline.unmet[0].delivery[0].should.equal('test_channel')
  timeline.unmet.length.should.equal(1)


}).done(function() {
  console.log("all is well")
})

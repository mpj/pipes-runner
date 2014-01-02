var chai = require('chai')
chai.Assertion.includeStack = true;
chai.should()
var expect = chai.expect

function timelineViewModel(timeline) {

  var events = timeline.events.slice(0)
  events.reverse()

  var allLines = []
  var items = events.map(function(e) {
    var item = { lines: [] }

    if (e.transform && e.transform.timedOut)
      item.lines.push({ key: 'sent', value: 'timed out', look: 'needsfixing'})

    if (e.sent)
      item.lines.push({ key: 'sent', value: e.sent.channel, _tooltip: e.sent.message })

    if (e.noRoute)
      item.lines.push({ key: 'route', value: 'none', look: 'needsfixing'})

    if (e.expectation)
      item.lines.push(
        { key: 'expected', value: e.received.channel, look: 'works',
          _tooltip: e.received.message })
    else
      item.lines.push({ key: 'received', value:  e.received.channel,
          _tooltip: e.received.message})

    allLines = allLines.concat(item.lines)
    return item
  })

  timeline.unmet.forEach(function(expectation) {
    var line = {
      key: 'expected',
      value: expectation.channel,
      look: 'needsfixing',
      _tooltip: expectation.message
    }
    items.unshift({
      lines: [line]
    })
    allLines.unshift(line)
  })


  var selectedIndex = 0

  function updateSelection() {
    allLines.forEach(function(line, index) {
      line.selected = index === selectedIndex
      line.tooltip = line.selected ? line._tooltip : undefined
    })
    if (this.onChange) this.onChange()
  }
  updateSelection()

  return {
    items: items,
    arrowDown: function() { selectedIndex++; this.updateSelection() },
    arrowUp: function() { selectedIndex--; this.updateSelection() },
    updateSelection: updateSelection
  }
}

module.exports = timelineViewModel

if (process.argv[2] === 'test') {

  var vm;

  vm = timelineViewModel({ world: { name: 'Empty world' },
    events: [
      { received: { channel: 'start', message: true },
        noRoute: true }
    ],
    unmet: [] })
  vm.items[0].lines[0].key.should.equal('route')
  vm.items[0].lines[0].value.should.equal('none')
  vm.items[0].lines[0].look.should.equal('needsfixing')

  vm.items[0].lines[1].key.should.equal('received')
  vm.items[0].lines[1].value.should.equal('start')

  vm.items[0].lines[0].selected.should.equal(true)
  vm.items[0].lines[1].selected.should.equal(false)


  vm = timelineViewModel({
    "events": [
      {
        "received": {
          "channel": "add",
          "message": [
            7,
            6
          ]
        },
        "noRoute": true
      },
      {
        "received": {
          "channel": "start",
          "message": true
        },
        "expectation": {
          "channel": "start",
          "message": true,
          "send": {
            "channel": "add",
            "message": [
              7,
              6
            ]
          }
        },
        "sent": {
          "channel": "add",
          "message": [
            7,
            6
          ]
        }
      }
    ],
    "unmet": []
  })

  var first = vm.items[0]
  first.lines[0].key  .should.equal('sent')
  first.lines[0].value.should.equal('add')
  first.lines[1].look .should.equal('works')
  first.lines[1].key  .should.equal('expected')
  first.lines[1].value.should.equal('start')

  var second = vm.items[1]
  second.lines[0].key.should.equal('route')
  second.lines[0].value.should.equal('none')
  second.lines[0].look.should.equal('needsfixing')
  second.lines[1].key  .should.equal('received')
  second.lines[1].value.should.equal('add')

  vm.items[1].lines[0].selected.should.equal(false)

  vm = timelineViewModel({
    "events": [
      {
        "received": {
          "channel": "add",
          "message": [
            7,
            6
          ]
        },
        "noRoute": true
      },
      {
        "received": {
          "channel": "start",
          "message": true
        },
        "expectation": {
          "channel": "start",
          "message": true,
          "send": {
            "channel": "add",
            "message": [
              7,
              6
            ]
          }
        },
        "sent": {
          "channel": "add",
          "message": [
            7,
            6
          ]
        }
      }
    ],
    "unmet": []
  })

  var onChangeWasCalled = false;
  vm.onChange = function() {
    onChangeWasCalled = true;
  }
  vm.items[0].lines[0].selected.should.equal(true)
  vm.items[0].lines[0].tooltip.should.deep.equal([7,6])
  expect(vm.items[0].lines[1].tooltip).to.be.undefined
  vm.arrowDown()
  onChangeWasCalled.should.equal(true)
  vm.items[0].lines[0].selected.should.equal(false)
  vm.items[0].lines[1].selected.should.equal(true)
  vm.items[0].lines[1].tooltip.should.equal(true)
  vm.arrowDown()
  vm.items[0].lines[1].selected.should.equal(false)
  vm.items[1].lines[0].selected.should.equal(true)
  vm.arrowUp()
  vm.items[1].lines[0].selected.should.equal(false)
  vm.items[0].lines[1].selected.should.equal(true)



  vm = timelineViewModel({
    "world": {},
    "events": [
      {
        "received": {
          "channel": "start",
          "message": true
        },
        "expectation": {
          "channel": "start",
          "message": true,
          "send": {
            "channel": "add",
            "message": [
              7,
              6
            ]
          }
        },
        "sent": {
          "channel": "add",
          "message": [
            7,
            6
          ]
        }
      },
      {
        "received": {
          "channel": "add",
          "message": [
            7,
            6
          ]
        },
        "transform": {
          "name": "add",
          "timedOut": true
        }
      }
    ],
    "unmet": []
  })

  vm.items[0].lines[0].key.should.equal("sent")
  vm.items[0].lines[0].value.should.equal("timed out")
  vm.items[0].lines[0].look.should.equal("needsfixing")


  vm = timelineViewModel({
    "world": {},
    "events": [
      {
        "received": {
          "channel": "start",
          "message": true
        },
        "expectation": {
          "channel": "start",
          "message": true,
          "send": {
            "channel": "add",
            "message": [
              7,
              6
            ]
          }
        },
        "sent": {
          "channel": "add",
          "message": [
            7,
            6
          ]
        }
      },
      {
        "received": {
          "channel": "add",
          "message": [
            7,
            6
          ]
        },
        "transform": {
          "name": "add"
        },
        "sent": {
          "channel": "add_success",
          "message": 13
        }
      }
    ],
    "unmet": [
      {
        "channel": "add_success",
        "message": 12
      }
    ]
  })

  vm.items[0].lines[0].key.should.equal('expected')
  vm.items[0].lines[0].value.should.equal('add_success')
  vm.items[0].lines[0].look.should.equal('needsfixing')
  vm.items[0].lines[0].tooltip.should.equal(12)


  console.log("**** YAY! All tests ran fine.")

}

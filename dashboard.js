var blessed = require('blessed')
, contrib = require('blessed-contrib')
var version = require('./package.json').version
var platform = require('os').platform()
class CliDraw {
  constructor() {
    this.screen = null
    this.grid = null
    this.totalTable = null
    this.detailsTable = null

    this.initBlessed()
  }

  initBlessed() {
    this.screen = blessed.screen()
    this.grid = new contrib.grid({rows: 12, cols: 12, screen: this.screen})

    this.screen.key(['escape', 'q', 'C-c', 'C-z'], function(ch, key) {
      this.screen.destroy();
      return process.exit(0);
    });

    this.initSurface()
  }

  initSurface() {
    this.totalTable = this.grid.set(0, 0, 12, 2, contrib.table, {
      keys: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: false,
      label: 'Goldshell Miner Total',
      width: '100%',
      height: '100%',
      border: {
          type: "line",
          fg: "cyan"
        },
      columnSpacing: 2, //in chars
      columnWidth: [18, 10] /*in chars*/
    })
    var localcolumnWidth = null;
    if (platform === 'darwin') {
      localcolumnWidth = [8, 18, 8, 8, 8, 36, 14, 14, 10, 10, 10, 16, 12]
    } else if (platform === 'win32') {
      localcolumnWidth = [8, 18, 8, 8, 8, 8, 14, 14, 10, 10, 10, 16, 12]
    } else {
      localcolumnWidth = [8, 18, 8, 8, 8, 12, 14, 14, 10, 10, 10, 16, 12]
    }
    this.detailsTable = this.grid.set(0, 2, 12, 10, contrib.table, {
      keys: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: true,
      label: 'Goldshell Miner Details' + ' (' + version + ')',
      width: '100%',
      height: '100%',
      border: {
          type: "line",
          fg: "cyan"
        },
      columnSpacing: 2, //in chars
      columnWidth: localcolumnWidth
   })

   this.detailsTable.focus()
   this.screen.render()
  }

  updateTotalTable(headers, stats) {
    this.totalTable.setData({ headers: headers, data: stats})
    this.screen.render()
  }

  updateDetailsTable(headers, stats) {
    this.detailsTable.setData({ headers: headers, data: stats})
    this.screen.render()
  }
}

module.exports = CliDraw;

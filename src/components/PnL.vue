<template>
  <div>
    {{ error }}
    <span>
      With futures: <input type="checkbox" id="futures" v-model="futures">
      Exp: <select v-model="exp">
        <option value="all">all</option>
        <option v-for="one in expirations()" v-bind:key="one" v-bind:value="one">
          {{ one }}
        </option>
      </select>
      after {{ days }} days ( {{ Math.round(daysExp - days) }} to exp)
       <button v-on:click="days = 0">now</button>
       <button v-on:click="days -= 1">-1</button>
       <button v-on:click="days += 1">+1</button>
       <button v-on:click="days = Math.ceil(daysExp)">exp</button>
       Pnl at <input v-model="level" placeholder="level" v-on:input="draw()"> <button v-on:click="level = 0">0</button>
       +/- <input v-model="spread" placeholder="spread" v-on:input="draw()"> <button v-on:click="spread = max"> {{ max }} </button> <button v-on:click="spread = 10000"> 10K </button>
    </span>
    <div id="pnl"></div>
  </div>
</template>

<script>
// TODO all expirations together or one by one
// Bound by max, min profit

import { mapState, mapGetters } from 'vuex'
import Chartist from 'chartist'
import Tooltip from 'chartist-plugin-tooltip'
import { price as BSPrice } from '../bs'
import _ from 'lodash/fp'
import zip from 'lodash/zip'

export default {
  name: 'PnL',
  props: ['symbol'],
  data: function() {
    return {
      error: null,
      days: null,
      level: 0,
      futures: true,
      spread: 100000,
      max: 100000,
      daysExp: 0,
      exp: null,
    }
  },
  computed: {
    ...mapGetters(['expirations', 'strikes', 'futurePrice', 'positions', 'ATMIV']),
    // ...mapState({}),
  },
  methods: {
    draw: function() {
      let data = this.data()
      this.max = Math.round(Math.max(...data.series[0].map(Math.abs)))
      this.spread = this.spread > this.max ? this.max : this.spread
      this.chart = new Chartist.Line('#pnl', this.data(), this.opts())
    },
    opts: function() {
      return {
        fullWidth: true,
        lineSmooth: false,
        height: 500,
        high: Math.round(this.level) + Math.round(this.spread),
        low: Math.round(this.level) - Math.round(this.spread),
        chartPadding: {
          right: 40,
        },
      }
    },
    data: function(st) {
      let state = this.$store.state

      let symbol = this.symbol || 'BTC'
      let expirations = this.exp === 'all' ? this.expirations() : [this.exp]

      let allStrikes = _.flow(
        _.map(exp => this.strikes(exp)),
        _.flatten,
        _.uniq,
        _.sortBy(Number),
      )(expirations)

      let posFut = this.positions(null, 'future')

      let r = _.flow(
        _.map(exp => {
          let expObj = state.symbol[symbol].opt[exp]
          let positions = this.positions(exp)
          let ATMIV = this.ATMIV(exp)

          let days = expObj.days && expObj.days > this.days ? expObj.days - this.days : 0

          return allStrikes.map(strike => {
            return _.flow(
              _.sumBy(p => {
                let [symbol, exp, pStrike, callPut] = p.instrument.split('-')

                // pUsd = BSPrice(opt.type, rate, strike, exdays, iv, ir);
                let price =
                  BSPrice(
                    callPut === 'C' ? 'call' : 'put',
                    strike,
                    +pStrike,
                    days,
                    ATMIV,
                  ) || 0

                return (price - p.avgUSD) * p.size
              }),
            )(positions)
          })
        }),
      )(expirations)

      r = this.exp === 'all' ? _.map(_.sum, zip(...r)) : r[0]

      if (this.futures) {
        r.forEach((pnl, i) => {
          r[i] =
            r[i] +
            _.sumBy(pos => {
              return 10 * pos.size * (1 / pos.avg - 1 / allStrikes[i]) * allStrikes[i]
            }, posFut)
        })
      }

      return {
        labels: allStrikes,
        series: [r],
      }
    },
  },
  watch: {
    exp: function(exp) {
      if (exp === 'all') {
        this.daysExp = 30
      } else {
        this.daysExp = this.$store.state.symbol.BTC.opt[exp].days
        if (this.days > this.daysExp) {
          this.days = Math.ceil(this.daysExp)
        }
      }

      this.draw()
    },
    days: function(days) {
      if (days < 0) this.days = 0
      this.draw()
    },
    futures: function() {
      this.draw()
    },
    spread: function() {
      this.draw()
    },
  },
}
</script>

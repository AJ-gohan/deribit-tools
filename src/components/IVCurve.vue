<template>
  <div>
    {{ error }}
    <span>Expiration: <select v-model="selected">
        <option v-for="one in expirations()" v-bind:key="one" v-bind:value="one">
          {{ one }}
        </option>
      </select>
    </span>
    <div id="ivcurve"></div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import Chartist from 'chartist'

export default {
  name: 'IVCurve',
  props: ['expiration', 'symbol'],
  data: function() {
    return {
      error: null,
      selected: null,
      chartOptions: {
        fullWidth: true,
        lineSmooth: false,
        high: 180,
        low: 50,
        height: 800,
        chartPadding: {
          right: 40,
        },
      },
    }
  },
  computed: {
    ...mapGetters(['expirations', 'strikes']),
    ...mapState({
      data(state) {
        let symbol = this.symbol || 'BTC'

        let selected = this.selected || this.expiration

        if (!this.expirations().includes(selected)) {
          this.error = `${selected} does not exist`
          return {}
        } else {
          this.error = null
        }

        if (state.symbol[symbol] && state.symbol[symbol].opt[selected]) {
          let exp = state.symbol[symbol].opt[selected]

          let strikes = this.strikes(selected)

          return {
            labels: strikes,
            series: [
              strikes.map(strike => exp.strike[strike].bidIV || null),
              strikes.map(strike => exp.strike[strike].askIV || null),
            ],
          }
        } else {
          return []
        }
      },
    }),
  },
  watch: {
    data: function(data) {
      this.chart = new Chartist.Line('#ivcurve', data, this.chartOptions)
    },
  },
}
</script>

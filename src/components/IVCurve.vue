<template>
  <div>
    {{ error }}
    {{ exp }}
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
export default {
  name: 'IVCurve',
  props: ['expiration', 'symbol'],
  data: function() {
    return {
      error: null,
    }
  },
  computed: {
    ...mapGetters(['expirations', 'strikes']),
    ...mapState({
      exp(state) {
        let symbol = this.symbol || 'BTC'

        if (!this.expirations(false).includes(this.expiration)) {
          this.error = `${this.expiration} does not exist`
          return []
        }

        if (state.symbol[symbol] && state.symbol[symbol].opt[this.expiration]) {
          let exp = state.symbol[symbol].opt[this.expiration]

          let strikes = this.strikes(this.expiration)

          return strikes.map(strike => ({
            strike,
            bid: exp.strike[strike].bidIV,
            ask: exp.strike[strike].askIV,
          }))
        } else {
          return []
        }
      },
    }),
  },
}
</script>

<template>
  <div>
    <span>
      Target: <input v-model="delta_target" placeholder="target">
      Step up/down: <input v-model="delta_up" placeholder="up" v-on:blur="check()"> <input v-model="delta_down" placeholder="down" v-on:blur="check()">
      Active: <input type="checkbox" v-model="active" v-on:change="check()">
      <br/>
      <button v-on:click="save()">Set</button>
    </span>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import _ from 'lodash/fp'

export default {
  name: 'DeltaHedge',
  data: function() {
    return {
      active: false,
      delta_target: 0,
      delta_up: 0,
      delta_down: 0,
    }
  },
  mounted() {
    let dh = this.dh
    this.delta_target = dh.target || 0
    this.delta_up = dh.up || 0
    this.delta_down = dh.down || 0
  },
  computed: {
    ...mapGetters(['futurePrice', 'delta']),
    ...mapState(['dh']),
  },
  methods: {
    check: function() {
      this.delta_up = Math.min(Math.max(this.delta_up, 0.5), this.delta_target)
      this.delta_down = Math.min(Math.max(this.delta_down, 0.5), this.delta_target)
    },
    save: function() {
      this.check()
      let delta = this.delta()
      let ratio = Math.abs(this.delta_target - delta) / Math.abs(delta)

      if (ratio > 0.5) {
        if (!confirm('You are changing delta too much. OK?')) return
      }

      this.$store.commit('deltaHedge', {
        active: this.active,
        target: +this.delta_target,
        up: +this.delta_up,
        down: +this.delta_down,
      })
    },
  },
}
</script>

import Vue from 'vue'
import App from './App.vue'
import './registerServiceWorker'

Vue.config.productionTip = false

Vue.prototype.$forceCompute = function (computedName: string, forceUpdate: true) {
  if (this._computedWatchers[computedName]) {
    this._computedWatchers[computedName].run()
    if (forceUpdate) this.$forceUpdate()
  }
}

new Vue({
  render: h => h(App)
}).$mount('#app')

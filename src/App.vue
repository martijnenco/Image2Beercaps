<template>
  <Layout id="app" theme='dark'>
    <header>
      <h1>Image 2 beercaps</h1>
      <h2>🌆 ➡ 2️⃣ ➡ 🐻+🔘</h2>
    </header>
    <Content theme='dark'>
      <Page />
    </Content>
    <Footer theme='dark'>
      <span>🌆 ➡ 2️⃣ ➡ 🐻+🔘</span>
      <span>copyrighted and made by me 😁</span>
    </Footer>
  </Layout>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import Page from './components/Page.vue'
import { Layout } from 'ant-design-vue'
const { Content, Footer } = Layout

@Component({
  name: 'App',

  components: {
    Layout,
    Page,
    Content,
    Footer
  }
})
export default class App extends Vue {}
</script>

<style lang="scss">
body {
  color: #2c3e50;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  margin: 0;
  padding: 0 5%;
  text-align: center;

  header {
    h1 {
      font-size: 20px;
      font-weight: 900;
      margin: 10px 0;
    }
  }

  footer {
    margin-top: 10px;

    span {
      padding: 0 10px;
    }
  }
}
</style>

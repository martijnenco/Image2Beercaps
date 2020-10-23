<template>
  <div>
    <Row>
      <Col :xs="12">
        <div>
          <Dragger
            name="file"
            :multiple="false"
            listType="picture-card"
            @change="handleUpload"
            :remove="handleRemove"
            :before-upload="beforeUpload"
          >
            <p
              v-if="fileList.length == 0"
              class="ant-upload-drag-icon"
            >
              <Icon type="inbox" />
            </p>
            <p
              v-if="fileList.length == 0"
              class="ant-upload-text"
            >
              Click or drag file to this area to upload
            </p>
          </Dragger>
        </div>
      </Col>
      <Col :xs="12">
      </Col>
    </Row>
  </div>
</template>

<script>
import Vue from 'vue'
import { Row, Col, Upload, Icon } from 'ant-design-vue'
const { Dragger } = Upload

export default Vue.extend({
  components: {
    Icon,
    Dragger,
    Row,
    Col
  },

  data () {
    return {
      fileList: [],
      uploading: false
    }
  },

  methods: {
    handleRemove (file) {
      const index = this.fileList.indexOf(file)
      const newFileList = this.fileList.slice()
      newFileList.splice(index, 1)
      this.fileList = newFileList
    },
    beforeUpload (file) {
      this.fileList = [...this.fileList, file]
      return false
    },
    handleUpload () {

    }
  }
})

</script>

<style lang="scss">
.ant-upload-drag {
  position: relative;
  float: right;
  width: 400px !important;
  height: 400px !important;
  text-align: center;
  background: #fafafa;
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
  padding: 5px;
  cursor: pointer;
  transition: border-color .3s;

}

div.ant-upload-list-picture-card-container .ant-upload-list-item-list-type-picture-card {
  position: absolute;
  top: 0 !important;
  right: 0 !important;
  width: 400px !important;
  height: 400px !important;
  margin: 0 !important;
}
</style>

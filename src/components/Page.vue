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
        <div class="resulting-image">
          <canvas
            width="300px"
            :height="`${(desiredRatio/1)*300}px`"
          />
        </div>
      </Col>
    </Row>
    <div class="config-input">
      <Input
        type="number"
        addonBefore="Your desired ratio"
        :value="desiredRatio"
        suffix=" :1"
        @change="(event) => desiredRatio = Number(event.target.value)"
      />
    </div>
    <div>
      <Table
        :data-source="caps"
        :pagination="false"
        :columns="[{
          title: 'Image',
          key: 'image',
          scopedSlots: { customRender: 'image' },
        }, {
          title: 'Color',
          dataIndex: 'color',
          key: 'color',
          scopedSlots: { customRender: 'color' },
        }, {
          title: 'Name',
          dataIndex: 'name',
          key: 'name',
          ellipsis: true,
        }, {
          title: 'Amount',
          dataIndex: 'amount',
          key: 'amount',
          scopedSlots: { customRender: 'amount' },
        }]"
      >
      </Table>
    </div>
  </div>
</template>

<script>
import Vue from 'vue'
import { Row, Input, Col, Upload, Table, Icon } from 'ant-design-vue'
const { Dragger } = Upload

export default Vue.extend({
  components: {
    Icon,
    Dragger,
    Table,
    Input,
    Row,
    Col
  },

  data () {
    return {
      fileList: [],
      uploading: false,
      desiredRatio: 1,
      caps: [{
        image: 'https://i.colnect.net/f/259/838/Hertog-Jan-Pilsener.jpg',
        name: 'Hertig Jan - Pils',
        amount: 30,
        color: { r: 150, g: 75, b: 0 }
      }]
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
  margin-right: 10px;
  position: relative;
  float: right;
  width: 300px !important;
  height: 300px !important;
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
  width: 300px !important;
  height: 300px !important;
  margin: 0 !important;
}

.resulting-image {
  canvas {
    margin-left: 10px;
    float: left;
    background: #fafafa;
    border: 1px dashed #d9d9d9;
    border-radius: 4px;
  }
}

.config-input {
  margin: 20px 0;

  &> span {
    width: 220px;
  }
}
</style>

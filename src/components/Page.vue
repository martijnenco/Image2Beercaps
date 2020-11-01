<template>
  <div>
    <Row>
      <Col class="justify-right" :xs="8">
        <p>Original image</p>
      </Col>
      <Col class="justify-center" :xs="8">
        <p>Image to mimic</p>
      </Col>
      <Col class="justify-left" :xs="8">
        <p>resulting image</p>
      </Col>
    </Row>
    <Row>
      <Col :xs="8">
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
      <Col :xs="8">
        <div class="mimic-image">
          <canvas
            :style="`width: 300px; height: ${(desiredRatio/1)*300}px`"
            :width="resultWidth"
            :height="resultHeight"
          />
        </div>
      </Col>
      <Col :xs="8">
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
      <Input
        type="number"
        addonBefore="Height"
        readOnly
        :value="resultHeight"
      />
      <Input
        type="number"
        addonBefore="Width"
        readOnly
        :value="resultWidth"
      />
      <Input
        type="number"
        addonBefore="Number of caps"
        readOnly
        :value="numberOfCaps"
      />
    </div>
    <div>
      <Table
        :data-source="caps"
        :pagination="false"
        :columns="[{
          title: 'Image',
          key: 'image',
          width: '150px',
          scopedSlots: { customRender: 'image' },
        }, {
          title: 'Color',
          dataIndex: 'color',
          key: 'color',
          width: '150px',
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
        <template slot="image" slot-scope="record">
          <img
            class="table-image"
            :src="record.image"
            :ref="`image-${record.image}`"
          >
        </template>
        <template slot="color" slot-scope="color">
          <Icon
            type="info-circle"
            theme="filled"
            :style="`color: rgb(${color.r}, ${color.g}, ${color.b}); font-size: 70px;`"
          />
        </template>
      </Table>
    </div>
  </div>
</template>

<script>
import Vue from 'vue'
import { Row, Input, Col, Upload, Table, Icon } from 'ant-design-vue'
import { getAverageColor } from '@/utils'
import hertogImage from '@/assets/Hertog-Jan-Pilsener.jpg'
import hertogEnkelImage from '@/assets/hertigjanenkel.jpg'
import amstelPilsImage from '@/assets/amstel-pils.jpg'
import heinekenPilsImage from '@/assets/heineken-pils.jpg'
import grolschPilsImage from '@/assets/grolsch-kroonkurk.jpg'
import leChouffeImage from '@/assets/lechouffe.jpg'
import brewdogBlueImage from '@/assets/brewdog-blauw.jpg'
import kwakImage from '@/assets/kwak.jpg'
import blackWhiteImage from '@/assets/Untitled.png'
const { Dragger } = Upload

export default Vue.extend({
  name: 'Page',

  components: {
    Icon,
    Dragger,
    Table,
    Input,
    Row,
    Col
  },

  data: function () {
    return {
      getAverageColor,
      fileList: [],
      uploading: false,
      desiredRatio: 1,
      caps: [{
        key: Math.random(),
        image: hertogImage,
        name: 'Hertig Jan - Pils',
        amount: 30,
        color: { r: 0, g: 0, b: 0 }
      }, {
        key: Math.random(),
        image: amstelPilsImage,
        name: 'Amstel - Pils',
        amount: 30,
        color: { r: 0, g: 0, b: 0 }
      }, {
        key: Math.random(),
        image: heinekenPilsImage,
        name: 'Heineken - Pils',
        amount: 30,
        color: { r: 0, g: 0, b: 0 }
      }, {
        key: Math.random(),
        image: grolschPilsImage,
        name: 'Grolsch - Pils',
        amount: 30,
        color: { r: 0, g: 0, b: 0 }
      }, {
        key: Math.random(),
        image: kwakImage,
        name: 'Kwak - Pils',
        amount: 30,
        color: { r: 0, g: 0, b: 0 }
      }, {
        key: Math.random(),
        image: hertogEnkelImage,
        name: 'Hertog Jan - Enkel',
        amount: 30,
        color: { r: 0, g: 0, b: 0 }
      }, {
        key: Math.random(),
        image: leChouffeImage,
        name: 'Le Chouffe',
        amount: 30,
        color: { r: 0, g: 0, b: 0 }
      }, {
        key: Math.random(),
        image: brewdogBlueImage,
        name: 'Brewdog blue',
        amount: 30,
        color: { r: 0, g: 0, b: 0 }
      }, {
        key: Math.random(),
        image: blackWhiteImage,
        name: 'black and white',
        amount: 30,
        color: { r: 0, g: 0, b: 0 }
      }
      ]
    }
  },

  computed: {
    numberOfCaps: function () {
      // return 200
      return this.caps.reduce((amount, item) => amount + item.amount, 0)
    },
    resultHeight: function () {
      return Math.floor(Math.pow(this.numberOfCaps / this.desiredRatio, 1 / 2) * this.desiredRatio)
    },
    resultWidth: function () {
      return Math.floor(Math.pow(this.numberOfCaps / this.desiredRatio, 1 / 2))
    }
  },

  async mounted () {
    await this.updateCaps()
    this.$forceUpdate()
  },

  methods: {
    async updateCaps () {
      await this.caps.map(async (cap, i) => {
        this.caps[i].color = await getAverageColor(cap.image)
      })
    },
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
      return undefined
    }
  }
})

</script>

<style lang="scss">
.justify-center {
  text-align: center;
}
.justify-right {
  text-align: right;
}
.justify-left {
  text-align: left;
}

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

.ant-upload-drag {
  margin: 0;
}
.ant-upload-list-picture .ant-upload-list-item-thumbnail, .ant-upload-list-picture-card .ant-upload-list-item-thumbnail {
  opacity: 1;
}
.ant-upload-list.ant-upload-list-picture-card span.ant-upload-list-item-actions a {
  display: none;
}

div.ant-upload-list-picture-card-container .ant-upload-list-item-list-type-picture-card {
  position: absolute;
  top: 0 !important;
  right: 0 !important;
  width: 300px !important;
  height: 300px !important;
  margin: 0 !important;
  padding: 0;
  opacity: 1;
}

.mimic-image,
.resulting-image {
  canvas {
    margin-left: 10px;
    margin-right: 10px;
    background: #fafafa;
    border: 1px dashed #d9d9d9;
    border-radius: 4px;
  }
}

.resulting-image {
  float: left;
}

.config-input {
  margin: 20px 0;

  &> span {
    width: 210px;
    margin: 0 5px;
  }
}

.ant-table {
  td.ant-table-row-cell-break-word {
    margin: 0;
    padding: 1px;
  }

  .table-image {
    width: 100px;
    height: 100px;
    border-radius: 50px;
  }
}
</style>

<template>
  <div>
    <Row>
      <Col :xs="24">
        <Button @click="newFile">📝 New</Button>
        <Button @click="saveFile">💾 Save</Button>
        <Button @click="triggerLoadFile">📂 Load</Button>
        <input ref="loadFileUpload" type="file" @change="loadFile" style="display: none;">
      </Col>
    </Row>
    <Row>
      <Col class="justify-right" :xs="8"><p>Original image</p></Col>
      <Col class="justify-center" :xs="8"><p>Image to mimic</p></Col>
      <Col class="justify-left" :xs="8"><p>Resulting image</p></Col>
    </Row>
    <Row>
      <Col :xs="8">
        <div>
          <ImageUpload
            langType="en"
            @crop-success="imgDataUrl => handleUpload(imgDataUrl)"
            v-model="openUploadImageModal"
            :width="300"
            :height="300"
            :noCircle="true"
            :noRotate="true"
            img-format="png"></ImageUpload>
          <img class="upload-image" v-if="uploadImage" :src="uploadImage" @click="() => openUploadImageModal = true" />
          <div v-else class="upload-image"  @click="() => openUploadImageModal = true">
            <span>Click here to upload an image</span>
          </div>
        </div>
      </Col>
      <Col :xs="8">
        <div class="mimic-image">
          <canvas
            ref="canvasImage"
            :style="`width: 300px; height: ${(desiredRatio/1)*300}px`"
            :width="resultWidth"
            :height="resultHeight"
          />
        </div>
      </Col>
      <Col :xs="8">
        <div class="resulting-image">
          <canvas
            ref="resultingImage"
            :style="`width: 300px; height: ${(desiredRatio/1)*300}px`"
            :width="resultWidth * 10"
            :height="resultHeight* 10"
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
        min="0.1"
        @change="(event) => desiredRatio = Number(event.target.value)"
      />
      <Input
        type="number"
        addonBefore="Height"
        readOnly
        step="1"
        :value="resultHeight"
      />
      <Input
        type="number"
        addonBefore="Width"
        readOnly
        step="1"
        :value="resultWidth"
      />
      <Input
        type="number"
        addonBefore="Number of caps available"
        readOnly
        :value="numberOfCaps"
      />
      <Input
        type="number"
        addonBefore="Number of caps used"
        readOnly
        :value="resultHeight * resultWidth"
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
          scopedSlots: { customRender: 'name' },
        }, {
          title: 'Amount',
          dataIndex: 'amount',
          key: 'amount',
          scopedSlots: { customRender: 'amount' },
        }, {
          title: 'Amount Used',
          dataIndex: 'amountUsed',
          key: 'amountUsed',
          scopedSlots: { customRender: 'amountUsed' },
        }, {
          title: '',
          scopedSlots: { customRender: 'remove' },
        }]"
      >
        <template slot="image" slot-scope="_, record">
          <ImageUpload
            langType="en"
            @crop-success="(imgDataUrl) => onCropSuccess(record, imgDataUrl)"
            v-model="record.open"
            :width="50"
            :height="50"
            :noSquare="true"
            :noRotate="true"
            img-format="png"></ImageUpload>
          <img class="table-image" :src="record.image" @click="() => record.open = true">
        </template>
        <template slot="color" slot-scope="color">
          <Icon
            type="info-circle"
            theme="filled"
            :style="`color: rgb(${color.r}, ${color.g}, ${color.b}); font-size: 70px;`"
          />
        </template>
        <template slot="name" slot-scope="_, record">
          <Input
            :value="record.name"
            @change="(event) => record.name = event.target.value"
          />
        </template>
        <template slot="amount" slot-scope="_, record">
          <Input
            type="number"
            step="1"
            min="0"
            :value="record.amount"
            @change="(event) => record.amount = Number(event.target.value)"
          />
        </template>
        <template slot="amountUsed" slot-scope="_, record">
          <Input
            type="number"
            readOnly
            :value="record.amountUsed || 0"
          />
        </template>
        <template slot="remove" slot-scope="_, record">
          <Button type="link" @click="() => removeBeercap(record)">❌</Button>
        </template>
      </Table>
      <Button
        class="add-new-beercap"
        type="primary"
        @click="addBeercap"
      >New 🐻+🔘</Button>
    </div>
  </div>
</template>

<script>
/* eslint-disable vue/no-async-in-computed-properties */

import Vue from 'vue'
import ImageUpload from 'vue-image-crop-upload/upload-2.vue'
import {
  Button,
  Col,
  Icon,
  Input,
  Row,
  Table
} from 'ant-design-vue'
import { getAverageColor, drawResultImage } from '@/utils'
import defaultSaveFile from '@/assets/defaultSaveFile.json'

export default Vue.extend({
  name: 'Page',

  components: {
    Button,
    Col,
    Icon,
    ImageUpload,
    Input,
    Row,
    Table
  },

  data: function () {
    return {
      defaultSaveFile,
      uploadImage: defaultSaveFile.uploadImage,
      openUploadImageModal: false,
      desiredRatio: defaultSaveFile.desiredRatio,
      caps: defaultSaveFile.caps.map((cap) => ({ ...cap, open: false }))
    }
  },

  computed: {
    numberOfCaps: function () {
      setTimeout(this.updateMimicImage, 100)
      return this.caps.reduce((amount, item) => amount + item.amount, 0)
    },
    resultHeight: function () {
      setTimeout(this.updateMimicImage, 100)
      return Math.floor(Math.pow(this.numberOfCaps / this.desiredRatio, 1 / 2) * this.desiredRatio)
    },
    resultWidth: function () {
      setTimeout(this.updateMimicImage, 100)
      return Math.floor(Math.pow(this.numberOfCaps / this.desiredRatio, 1 / 2))
    }
  },

  async mounted () {
    await this.updateCapColors()
    console.log(this)
  },

  methods: {
    // Resolve file new/save/load
    newFile () {
      this.caps = []
      this.uploadImage = undefined
      this.desiredRatio = 1
    },
    saveFile () {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ caps: this.caps, uploadImage: this.uploadImage, desiredRatio: this.desiredRatio })], { type: 'application/json' }))
      a.download = 'image2beercaps-save-file.json'
      a.click()
      URL.revokeObjectURL(a.href)
    },
    triggerLoadFile () {
      this.$refs.loadFileUpload.click()
    },
    loadFile (event) {
      const reader = new FileReader()
      reader.onload = ({ target }) => {
        const result = JSON.parse(target.result)
        this.caps = result.caps
        this.uploadImage = result.uploadImage
        this.desiredRatio = result.desiredRatio
      }
      reader.readAsText(event.target.files[0])
    },

    // Handle image
    handleUpload (imgDataUrl) {
      this.uploadImage = imgDataUrl
      setTimeout(this.updateMimicImage, 100)
    },
    async updateMimicImage () {
      if (!this.uploadImage) return
      const baseImage = new Image()
      baseImage.src = this.uploadImage
      baseImage.onload = () => {
        const context = this.$refs.canvasImage.getContext('2d')
        context.imageSmoothingEnabled = false
        context.drawImage(baseImage, 0, 0, this.resultWidth, this.resultHeight)
        this.updateResultingImage()
      }
    },
    async updateResultingImage() {
      const context = this.$refs.resultingImage.getContext('2d')
      context.imageSmoothingEnabled = false
      console.log(this.$refs.canvasImage)
      drawResultImage(this.$refs.canvasImage, this.$refs.resultingImage, this.caps)
    },

    // Handle caps
    async onCropSuccess (record, imgDataUrl) {
      record.image = imgDataUrl
      record.color = await getAverageColor(imgDataUrl)
    },
    async updateCapColors () {
      await this.caps.map(async (cap) => {
        cap.color = await getAverageColor(cap.image)
      })
    },
    removeBeercap (cap) {
      const index = this.caps.indexOf(cap)
      const newCapList = this.caps.slice()
      newCapList.splice(index, 1)
      this.caps = newCapList
    },
    addBeercap () {
      this.caps.push({
        key: Math.random(),
        open: true,
        image: '',
        name: '',
        amount: 0,
        color: { r: 255, g: 255, b: 255 }
      })
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

button {
  margin: 10px;
}

.upload-image {
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
  transition: border-color .3s;
  cursor: pointer;
  background: #fafafa;
  width: 300px;
  height: 300px;
  margin: 0;
  padding: 0;
  position: absolute;
  top: 0;
  right: 0;
}

.mimic-image {
  image-rendering: pixelated;
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
    width: max-content;
    margin: 0 5px;

    &:first-child {
      width: 210px;
    }
  }
}

.ant-table {
  td.ant-table-row-cell-break-word {
    margin: 0;
    padding: 1px;
  }

  .table-image {
    cursor: pointer;
    width: 100px;
    height: 100px;
    border-radius: 50px;
  }
}

.add-new-beercap {
  width: -webkit-fill-available;
  margin: 20p;
  font-size: xxx-large;
  height: auto;
}
</style>

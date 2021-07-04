import { RGB } from '../types/RGB'
import getAverageColor from './getAverageColor'

export interface Cap {
  key: number;
  image: string;
  name: string;
  amount: number;
  color: RGB;
};

export default async (sourceImageCanvas: HTMLCanvasElement, resultImageCanvas: HTMLCanvasElement, caps: Array<Cap>) => {
  const averageSourceImageColor = await getAverageColor(sourceImageCanvas.toDataURL())
  console.log(averageSourceImageColor)
  const totalAmountCaps = caps.reduce((amount, item) => amount + item.amount, 0)
  console.log(totalAmountCaps)
  const averageCapsColor = caps.reduce((avarageColor, cap) => ({
    r: avarageColor.r + ~~(cap.amount / totalAmountCaps * cap.color.r),
    g: avarageColor.g + ~~(cap.amount / totalAmountCaps * cap.color.g),
    b: avarageColor.b + ~~(cap.amount / totalAmountCaps * cap.color.b)
  }), { r: 0, g: 0, b: 0 })
  console.log(averageCapsColor)
}

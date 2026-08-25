export interface Product {
  id: number
  name: string
  description: string
  price: number
  image: string
}

export const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Explorer Backpack",
    description: "A great backpack for a great price",
    price: 29.99,
    image: "/colorful-backpack-on-wooden-table.png",
  },
  {
    id: 2,
    name: "Flight Jacket",
    description: "Classic bomber jacket. Ideal for flight tests",
    price: 49.99,
    image: "/flight-jacket.jpg",
  },
  {
    id: 3,
    name: "LED Bike Light",
    description: "A red light stays red until you flip the power switch",
    price: 9.99,
    image: "/bike-light.jpg",
  },
  {
    id: 4,
    name: "Bold Graphic Tee",
    description: "Look brave, kid. Make history. Join us today then help us take on the competition.",
    price: 22.0,
    image: "/bold-tshirt.jpg",
  },
  {
    id: 5,
    name: "Cozy Fleece Jacket",
    description: "It's not a mess, it's a performance migraine.",
    price: 49.99,
    image: "/fleece-jacket.jpg",
  },
  {
    id: 6,
    name: "Baby Onesie",
    description: "Uh... not sure what the color of this one is.",
    price: 7.99,
    image: "/onesie.jpg",
  },
]

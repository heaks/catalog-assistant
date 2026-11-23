import { toEmbeddingText, toProduct } from './flipkart.parser.js';

const row = {
  pid: 'SRTEH2FF9KEDEFGF',
  product_name: "Alisha Solid Women's Cycling Shorts",
  brand: 'Alisha',
  product_category_tree:
    '["Clothing >> Women\'s Clothing >> Lingerie, Sleep & Swimwear >> Shorts >> Alisha Shorts"]',
  discounted_price: '379',
  retail_price: '999',
  image:
    '["http://img5a.flixcart.com/image/short/u/4/a/a.jpeg", "http://img6a.flixcart.com/b.jpeg"]',
  description: 'Key Features of Alisha Shorts   Cotton Lycra   Navy',
};

describe('toProduct', () => {
  it('maps a Flipkart row to a product', () => {
    expect(toProduct(row)).toEqual({
      id: 'SRTEH2FF9KEDEFGF',
      name: "Alisha Solid Women's Cycling Shorts",
      brand: 'Alisha',
      category: "Clothing > Women's Clothing > Lingerie, Sleep & Swimwear",
      description: 'Alisha Shorts Cotton Lycra Navy',
      priceUsdCents: 457,
      imageUrl: 'https://rukminim1.flixcart.com/image/short/u/4/a/a.jpeg',
    });
  });

  it('falls back to retail price and tolerates missing fields', () => {
    const p = toProduct({
      ...row,
      discounted_price: '',
      brand: '',
      image: '',
      product_category_tree: '["Just a name"]',
    });
    expect(p).toMatchObject({
      priceUsdCents: 1204,
      brand: null,
      imageUrl: null,
      category: null,
    });
  });

  it('skips rows without id or name', () => {
    expect(toProduct({ ...row, pid: '' })).toBeNull();
  });
});

describe('toEmbeddingText', () => {
  it('omits empty parts', () => {
    const p = toProduct({ ...row, brand: '' })!;
    expect(toEmbeddingText(p)).toBe(
      "Alisha Solid Women's Cycling Shorts. Category: Clothing > Women's Clothing > Lingerie, Sleep & Swimwear. Alisha Shorts Cotton Lycra Navy",
    );
  });
});

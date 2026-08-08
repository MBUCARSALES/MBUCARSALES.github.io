/* ============================================================================
   DEMO STOCK
   ----------------------------------------------------------------------------
   These example cars are shown ONLY while Supabase is not connected, so you
   can see the site working straight away. As soon as you fill in the Supabase
   details in config.js, real stock replaces all of this automatically.

   You can safely delete this file once you are live (and remove its <script>
   tag from each page).
   ========================================================================== */

const U = id => `https://images.unsplash.com/photo-${id}?w=1200&q=75&auto=format&fit=crop`;

const DAY = 86400000;
const daysAgo = n => new Date(Date.now() - n * DAY).toISOString();

window.MBU_DEMO_CARS = [
  {
    id: 'demo-1', slug: 'vw-golf-gt-tdi',
    status: 'available', featured: true, sort_index: 1,
    registration: 'YK18 HXR',
    make: 'Volkswagen', model: 'Golf', variant: 'GT TDI DSG',
    year: 2018, price: 9450, mileage: 62400,
    fuel: 'diesel', transmission: 'automatic', body_type: 'hatchback',
    doors: 5, engine_size: 2.0, colour: 'Indium Grey',
    previous_owners: 2, mot_expiry: '2027-03-14',
    service_history: 'full', hpi_status: 'clear',
    condition_notes: '',
    description: 'A really tidy GT with the 2.0 TDI and DSG box — the pick of the range if you do a lot of miles. Two owners from new, full main-dealer service history and a fresh MOT with no advisories. Drives faultlessly, gearbox is smooth and the interior is unmarked. Adaptive cruise, heated seats and the digital dash make it feel far newer than it is.',
    features: ['Adaptive cruise control', 'Heated front seats', 'Digital cockpit', 'Apple CarPlay', 'Parking sensors front & rear', 'DAB radio', 'Bluetooth', 'Alloy wheels'],
    images: [U('1471479917193-f00955256257'), U('1503376780353-7e6692767b70'), U('1605559424843-9e4c228bf1c2'), U('1552519507-da3b142c6e3d')],
    created_at: daysAgo(4)
  },
  {
    id: 'demo-2', slug: 'ford-fiesta-zetec',
    status: 'available', featured: true, sort_index: 2,
    registration: 'NL16 UWZ',
    make: 'Ford', model: 'Fiesta', variant: 'Zetec',
    year: 2016, price: 4295, mileage: 71800,
    fuel: 'petrol', transmission: 'manual', body_type: 'hatchback',
    doors: 5, engine_size: 1.0, colour: 'Frozen White',
    previous_owners: 3, mot_expiry: '2027-01-22',
    service_history: 'part', hpi_status: 'clear',
    condition_notes: '',
    description: 'Ideal first car or second family car. The 1.0 EcoBoost is genuinely good — plenty quick enough and cheap to tax and insure. A few small stone chips on the bonnet which we have not tried to hide, otherwise very clean inside and out. Timing belt and water pump done at 68,000 miles with receipts.',
    features: ['Air conditioning', 'Bluetooth', 'DAB radio', 'Alloy wheels', 'Electric windows', 'Isofix'],
    images: [U('1494976388531-d1058494cdd8'), U('1550355291-bbee04a92027')],
    created_at: daysAgo(9)
  },
  {
    id: 'demo-3', slug: 'nissan-qashqai-acenta',
    status: 'available', featured: true, sort_index: 3,
    registration: 'DK17 OPV',
    make: 'Nissan', model: 'Qashqai', variant: 'Acenta Premium DCi',
    year: 2017, price: 7995, mileage: 84200,
    fuel: 'diesel', transmission: 'manual', body_type: 'suv',
    doors: 5, engine_size: 1.5, colour: 'Gun Metallic',
    previous_owners: 2, mot_expiry: '2027-05-09',
    service_history: 'full', hpi_status: 'cat_n',
    condition_notes: 'Category N — recorded for a rear-quarter panel and bumper following a low-speed car park knock. Repaired properly by our own bodyshop, panel gaps and paint match are spot on. Structurally untouched, and priced accordingly. Happy to show you the before-and-after photos.',
    description: 'The family SUV that makes sense. Panoramic roof, 360 camera and the frugal 1.5 diesel. This one is a Category N — read the condition notes above, we are completely open about it, and it is reflected in the price. Mechanically excellent with a full service history.',
    features: ['Panoramic glass roof', '360° camera', 'Sat nav', 'Cruise control', 'Climate control', 'Parking sensors', 'Bluetooth'],
    images: [U('1568605117036-5fe5e7bab0b7'), U('1544636331-e26879cd4d9b'), U('1533473359331-0135ef1b58bf')],
    created_at: daysAgo(12)
  },
  {
    id: 'demo-4', slug: 'audi-a3-sport',
    status: 'reserved', featured: false, sort_index: 4,
    registration: 'SG19 TFC',
    make: 'Audi', model: 'A3', variant: 'Sport TFSI S Tronic',
    year: 2019, price: 12750, mileage: 48900,
    fuel: 'petrol', transmission: 'automatic', body_type: 'hatchback',
    doors: 5, engine_size: 1.5, colour: 'Nano Grey',
    previous_owners: 1, mot_expiry: '2027-06-30',
    service_history: 'full', hpi_status: 'clear',
    condition_notes: '',
    description: 'One owner from new with full Audi history. Virtual cockpit, half leather and the smooth S Tronic gearbox. Presents almost as new — genuinely one of the nicest A3s we have had through.',
    features: ['Virtual cockpit', 'Half leather', 'Sat nav', 'Cruise control', 'Rear parking sensors', 'Apple CarPlay', 'LED headlights'],
    images: [U('1519641471654-76ce0107ad1b'), U('1541899481282-d53bffe3c35d')],
    created_at: daysAgo(6)
  },
  {
    id: 'demo-5', slug: 'vauxhall-corsa-sri',
    status: 'available', featured: false, sort_index: 5,
    registration: 'YD15 LNB',
    make: 'Vauxhall', model: 'Corsa', variant: 'SRi',
    year: 2015, price: 3150, mileage: 88600,
    fuel: 'petrol', transmission: 'manual', body_type: 'hatchback',
    doors: 3, engine_size: 1.4, colour: 'Power Red',
    previous_owners: 4, mot_expiry: '2026-11-18',
    service_history: 'part', hpi_status: 'clear',
    condition_notes: 'Small scuff on the nearside rear bumper, pictured. Nothing structural, we have left it rather than charge you for a respray you may not care about.',
    description: 'Cheap, honest transport that has just had a full service, four new tyres and a fresh MOT. Perfect for a new driver. The scuff on the rear bumper is shown in the photos and is reflected in the price.',
    features: ['Air conditioning', 'Cruise control', 'Alloy wheels', 'Bluetooth', 'Electric windows'],
    images: [U('1502877338535-766e1452684a'), U('1492144534655-ae79c964c9d7')],
    created_at: daysAgo(18)
  },
  {
    id: 'demo-6', slug: 'bmw-320d-m-sport',
    status: 'available', featured: true, sort_index: 6,
    registration: 'MA17 EBK',
    make: 'BMW', model: '3 Series', variant: '320d M Sport Auto',
    year: 2017, price: 11250, mileage: 76300,
    fuel: 'diesel', transmission: 'automatic', body_type: 'saloon',
    doors: 4, engine_size: 2.0, colour: 'Mineral Grey',
    previous_owners: 2, mot_expiry: '2027-02-11',
    service_history: 'full', hpi_status: 'clear',
    condition_notes: '',
    description: 'M Sport with the good spec — professional navigation, heated leather and 18" alloys. Full BMW service history and a recent major service including oil, filters and brake fluid. The eight-speed auto is superb and it will still return well over 50mpg on a run.',
    features: ['Heated leather seats', 'Professional navigation', 'Cruise control', 'Front & rear sensors', 'Bluetooth', '18" alloy wheels', 'DAB radio'],
    images: [U('1580273916550-e323be2ae537'), U('1555215695-3004980ad54e'), U('1503376780353-7e6692767b70')],
    created_at: daysAgo(2)
  },
  {
    id: 'demo-7', slug: 'mercedes-a-class-sport',
    status: 'available', featured: false, sort_index: 7,
    registration: 'FN16 RVU',
    make: 'Mercedes-Benz', model: 'A-Class', variant: 'A180d Sport',
    year: 2016, price: 8450, mileage: 69100,
    fuel: 'diesel', transmission: 'manual', body_type: 'hatchback',
    doors: 5, engine_size: 1.5, colour: 'Cosmos Black',
    previous_owners: 2, mot_expiry: '2027-04-02',
    service_history: 'full', hpi_status: 'clear',
    condition_notes: '',
    description: 'Cheap to run and it still feels a cut above inside. £20 a year road tax, comfortable on a long run and the black paint is in lovely condition. Two owners with a full service history.',
    features: ['Sat nav', 'Reversing camera', 'Half leather', 'Cruise control', 'Bluetooth', 'Alloy wheels'],
    images: [U('1552519507-da3b142c6e3d'), U('1618843479313-40f8afb4b4d8')],
    created_at: daysAgo(15)
  },
  {
    id: 'demo-8', slug: 'ford-focus-titanium',
    status: 'available', featured: false, sort_index: 8,
    registration: 'WP14 CGZ',
    make: 'Ford', model: 'Focus', variant: 'Titanium Navigator TDCi',
    year: 2014, price: 3995, mileage: 103500,
    fuel: 'diesel', transmission: 'manual', body_type: 'estate',
    doors: 5, engine_size: 1.6, colour: 'Deep Impact Blue',
    previous_owners: 3, mot_expiry: '2027-01-05',
    service_history: 'full', hpi_status: 'clear',
    condition_notes: '',
    description: 'A proper workhorse estate with a big boot and £30 road tax. Higher mileage but a full stamped history and it drives beautifully — motorway miles, not town miles. New clutch at 96,000 with the receipt in the folder.',
    features: ['Sat nav', 'Heated windscreen', 'Cruise control', 'Parking sensors', 'Bluetooth', 'Air conditioning'],
    images: [U('1533473359331-0135ef1b58bf'), U('1547744152-14d985cb937f')],
    created_at: daysAgo(24)
  },
  {
    id: 'demo-9', slug: 'kia-sportage-2',
    status: 'available', featured: false, sort_index: 9,
    registration: 'BT66 AXD',
    make: 'Kia', model: 'Sportage', variant: '2 CRDi ISG',
    year: 2016, price: 7250, mileage: 79400,
    fuel: 'diesel', transmission: 'manual', body_type: 'suv',
    doors: 5, engine_size: 1.7, colour: 'Silky Silver',
    previous_owners: 2, mot_expiry: '2027-03-28',
    service_history: 'full', hpi_status: 'clear',
    condition_notes: '',
    description: 'Practical, roomy and famously reliable. Full service history and a good set of tyres all round. Ideal if you want something dependable that will not cost a fortune to keep on the road.',
    features: ['Reversing camera', 'Heated seats', 'Cruise control', 'Bluetooth', 'Air conditioning', 'Alloy wheels'],
    images: [U('1541899481282-d53bffe3c35d'), U('1568605117036-5fe5e7bab0b7')],
    created_at: daysAgo(20)
  },
  {
    id: 'demo-10', slug: 'vw-polo-match',
    status: 'available', featured: false, sort_index: 10,
    registration: 'LV65 JHT',
    make: 'Volkswagen', model: 'Polo', variant: 'Match',
    year: 2015, price: 4650, mileage: 64700,
    fuel: 'petrol', transmission: 'manual', body_type: 'hatchback',
    doors: 5, engine_size: 1.2, colour: 'Reflex Silver',
    previous_owners: 2, mot_expiry: '2027-02-19',
    service_history: 'full', hpi_status: 'clear',
    condition_notes: '',
    description: 'Low mileage for the year and a genuinely nice little car. Cheap insurance group, so a very sensible choice for a younger driver. Fresh MOT with no advisories.',
    features: ['Air conditioning', 'Bluetooth', 'DAB radio', 'Alloy wheels', 'Isofix', 'Electric windows'],
    images: [U('1492144534655-ae79c964c9d7'), U('1471479917193-f00955256257')],
    created_at: daysAgo(11)
  },

  /* ----------------------------- Recently sold ---------------------------- */
  {
    id: 'demo-s1', slug: 'sold-vauxhall-astra',
    status: 'sold', sold_at: daysAgo(6), sort_index: 100,
    registration: 'YE16 KTM',
    make: 'Vauxhall', model: 'Astra', variant: 'SRi CDTi',
    year: 2016, price: 5450, mileage: 74800,
    fuel: 'diesel', transmission: 'manual', body_type: 'hatchback',
    doors: 5, engine_size: 1.6, colour: 'Sovereign Silver',
    service_history: 'full', hpi_status: 'clear',
    description: 'Sold to a lovely couple from Gateshead. Thanks for your business!',
    features: [], images: [U('1550355291-bbee04a92027')],
    created_at: daysAgo(40)
  },
  {
    id: 'demo-s2', slug: 'sold-seat-leon',
    status: 'sold', sold_at: daysAgo(19), sort_index: 101,
    registration: 'RJ17 BWA',
    make: 'SEAT', model: 'Leon', variant: 'FR Technology TDi',
    year: 2017, price: 8950, mileage: 58200,
    fuel: 'diesel', transmission: 'manual', body_type: 'hatchback',
    doors: 5, engine_size: 2.0, colour: 'Nevada White',
    service_history: 'full', hpi_status: 'clear',
    description: '', features: [], images: [U('1503376780353-7e6692767b70')],
    created_at: daysAgo(55)
  },
  {
    id: 'demo-s3', slug: 'sold-toyota-yaris',
    status: 'sold', sold_at: daysAgo(31), sort_index: 102,
    registration: 'MK15 ZDN',
    make: 'Toyota', model: 'Yaris', variant: 'Icon VVT-i',
    year: 2015, price: 4750, mileage: 51300,
    fuel: 'petrol', transmission: 'automatic', body_type: 'hatchback',
    doors: 5, engine_size: 1.3, colour: 'Chilli Red',
    service_history: 'full', hpi_status: 'clear',
    description: '', features: [], images: [U('1502877338535-766e1452684a')],
    created_at: daysAgo(70)
  },
  {
    id: 'demo-s4', slug: 'sold-range-rover-evoque',
    status: 'sold', sold_at: daysAgo(47), sort_index: 103,
    registration: 'GX16 PPO',
    make: 'Land Rover', model: 'Range Rover Evoque', variant: 'SE Tech TD4',
    year: 2016, price: 13950, mileage: 67900,
    fuel: 'diesel', transmission: 'automatic', body_type: 'suv',
    doors: 5, engine_size: 2.0, colour: 'Santorini Black',
    service_history: 'full', hpi_status: 'clear',
    description: '', features: [], images: [U('1544636331-e26879cd4d9b')],
    created_at: daysAgo(95)
  },
  {
    id: 'demo-s5', slug: 'sold-mini-cooper',
    status: 'sold', sold_at: daysAgo(58), sort_index: 104,
    registration: 'PO15 HRE',
    make: 'MINI', model: 'Cooper', variant: 'Cooper D',
    year: 2015, price: 6250, mileage: 62100,
    fuel: 'diesel', transmission: 'manual', body_type: 'hatchback',
    doors: 3, engine_size: 1.5, colour: 'Chili Red',
    service_history: 'part', hpi_status: 'clear',
    description: '', features: [], images: [U('1555215695-3004980ad54e')],
    created_at: daysAgo(110)
  }
];

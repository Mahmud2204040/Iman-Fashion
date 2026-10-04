> ARCHIVED on 2026-10-01. Historical reference only; this file is not an active specification.
> Read [the active documentation index](../../README.md) before using any rule or completion claim below.

. 
ববসার
 
পিরিচিত
 
ও
 
বতমান
 
সমসা
১
NI Fashion school ও college-এর িবিভন ধরেনর dress িবি কের এবং িনেজরাই dress তির কের। পধান 
finished products হেলা shirt, pant, salwar, kamiz, urna, frock ইতািদ; accessories িহেসেব shoe, 
bag ইতািদও িবি হয়। Dress তিরর জন কাপড় , button ইতািদ raw material িকনেত হয়।
বতমান িহসােবর একি বড় অংশ manual/খাতািভিত্তক। ফেল daily sales, product-wise quantity, customer 
history, custom order due, supplier due, stock movement, expense এবং cash-এর িহসাব 
centralizedভােব দখা কিঠন। নতুন system-এর উে শ হেলা এই operational data এক জায়গায় 
structuredভােব সংরক্ষণ করা।
২
. 
পধান
 
উে শ
দিনক sales record ও product-wise sold quantity track করা।
Customer-এর name, phone, optional address এবং children-এর তথ সংরক্ষণ করা।
Customer-এর total purchase history রাখা।
Custom-size/custom dress order-এর advance, due, status ও delivery track করা।
Finished product-এর current stock ও stock history রাখা।
Supplier-wise purchase history, payment history ও current due রাখা।
Raw material-এর basic inventory আলাদাভােব record করা।
Monthly/yearly expense িহসাব রাখা।
Daily shop cash-এর opening, cash-in, cash-out ও current balance track করা।
Physical receipt-এর সে system Sales ID িমিলেয় পের sale খু ঁেজ বর করা।
Owner-এর জন পেয়াজনীয় reports পদান করা।
৩
. User Roles
System-এ আলাদা Admin role থাকেব না। দুই ধরেনর user থাকেব: Owner এবং Employee/Staff।
Owner:
সব module ও report access করেত পারেব।
Product create/edit/inactive করেত পারেব।
Purchase price input ও দখেত পারেব।
Sales edit/cancel করেত পারেব।
Supplier, purchase, payment, expense ও cash manage করেত পারেব।
Profit দখেত পারেব যিদ purchase price available থােক।
Employee:
Normal sales করেত পারেব।
Customer search করেত পারেব এবং পেয়াজন হেল sale screen থেক customer create করেত 
পারেব।
Customer-এর name, phone, children basic info এবং custom-order due-এর পেয়াজনীয় 
information দখেত পারেব।
Purchase cost, supplier due/payment, expense, cash, profit ও reports দখেত পারেব 
না।
Product inactive/delete করেত পারেব না।
Existing sale edit/cancel করেত পারেব না।
৪
. Customer Management
পিতি customer-এর একি auto-generated unique Customer ID থাকেব। Customer delete করা যােব 
না। Customer-এর historical transaction নষ্ট না করাই মূল উে শ।
Customer fields:
Customer ID — system generated.
Name — required.
Phone — primary search field.
Address — optional.
Notes — optional.
Created date/time.
Updated date/time.
একই phone number-এর জন duplicate customer account তির হেব না; একই customer account 
ববহার হেব। Phone number পরবতেত edit করা যােব। Customer search হেব Customer ID, Name 
অথবা Phone িদেয়।
Customer-এর overall purchase history customer account-এর অধীেন থাকেব। কােনা normal sale 
কান child-এর জন হেয়েছ তা আলাদা কের link করা হেব না, কারণ requirement অনুযায়ী customer-level 
purchase history-ই গুর পূণ।
৫
. Children Management
একজন customer-এর ১–৪ জন child থাকেত পারেব। Child-এর school child record-এর সােথ থাকেব; 
school-এর জন আলাদা master database বা school-wise database থাকেব না। Child-এর school 
ভিবষেত পিরবতন করা যােব।
Child fields:
Child ID.
Customer ID.
Name.
Class.
School.
Notes.
Created date.
Last class update date.
Final class rule: Child যিদন system-এ create হেব, সই date-ক িভিত্ত ধের িঠক এক বছর পর class ১ 
কের বাড় েব। Class 11/12-এর পরও একই rule চলেব; কােনা stop rule নই।
Example: Created 01 Sep 2026, Class 5 → 01 Sep 2027 Class 6 → 01 Sep 2028 Class 
7 → 01 Sep 2029 Class 8 → ... → Class 12 → এরপরও পিত বছর +1।
System child creation date এবং last class update date রাখেব। Scheduled/background logic 
বা equivalent server-side date check ববহার কের yearly update িনি চত করেত হেব এবং duplicate 
increment ঠকােত হেব।
৬
. Product Management
Finished product-এর জন Product ID থাকেব। Product-এর type, size ও colour আলাদা column 
িহেসেব রাখা হেব না। Product title-এ descriptive information থাকেব।
উদাহরণ: Navy Blue Pant - XXL, Blue Shirt - 40।
Product fields:
Product ID — unique.
Product Name/Title — required.
Purchase Price — optional এবং Owner-only.
Current Stock.
Notes — optional.
Status — Active/Inactive.
Created/Updated date.
কােনা default selling price থাকেব না। পিতবার sale করার সময় employee/owner selling price 
manually input করেব। একই product different selling price-এ িবি হেত পাের।
Finished product piece-wise stock হেব। Stock 0 হেল normal sale করা যােব না। Owner product 
inactive করেত পারেব; employee পারেব না। Permanent delete করা হেব না।
৭
. Normal Sales
Normal sale হেলা দাকােন available finished product customer-ক সরাসির িবি করা। Normal sale
এ customer full payment করেব; customer due থাকেব না। সব normal-sale payment cash িহেসেব 
গণ হেব এবং payment method field থাকেব না।
Workflow:
Customer-এর Phone/Name/Customer ID িদেয় search.
Customer না থাকেল sale screen থেকই create করা যােব; চাইেল পের manually profile 
create করা যােব।
Product Name বা Product ID িদেয় search.
Product select.
Quantity input.
Selling price manually input.
একই sale-এ একই product আবার select করা যােব না; quantity একই line item-এ update করেত 
হেব।
System total calculate করেব।
Customer full amount pay করেব।
Unique Sales ID generate হেব।
Stock automatically decrease হেব।
Sale history ও stock movement save হেব।
Normal sale-এর due সবসময় 0। Partial payment normal sale-এ নই।
৮
. Sales ID 
ও
 Physical Receipt
পিতি sale-এর unique Sales ID থাকেব, যমন SALE-000157। App বতমােন physical receipt 
generate/print করেব না; দাকােনর receipt book আেগর মেতা থাকেব। Employee/Owner physical 
receipt-এর ওপর system Sales ID িলেখ রাখেত পারেব।
পরবতেত Sales ID search করেল complete digital sale history পাওয়া যােব। Sales ID 
immutable/unique হেব; sale edit হেলও ID বদলােব না। Cancelled sale-এর historical recordও ID 
সহ রাখা উিচত।
৯
. Custom Order
দাকােন requested size/fabric/product না থাকেল বা customer custom dress চাইেল normal sale-এর 
পিরবেত Custom Order flow ববহার হেব। Order-এর সময় advance নওয়া হেব এবং delivery-এর সময় 
remaining due নওয়া হেব।
Required fields:
Order ID.
Customer.
Product.
Description.
Total Price.
Advance.
Due.
Expected Delivery Date.
Order Date.
Delivery Date.
Notes.
Status (Pending, Ready, Delivered, Canceled).
Measurement-এর জন আলাদা structured fields থাকেব না। Custom measurement/design/special 
instruction Description বা Notes-এ লখা হেব।
Custom order stock-এর কােনা effect করেব না। এি finished stock reserve/decrease করেব না।
Custom order-এর multiple payment history থাকেব। Advance এবং পরবত final payment আলাদা 
records িহেসেব রাখা হেব। Due = Total Price − recorded payments।
Order cancel হেল advance refund করা হেব না। V1-এ refund workflow নই।
১০
. Finished Product Inventory
Finished-product inventory piece-wise track হেব। Stock increase/decrease-এর পধান source 
হেব initial/manual entry, purchase/receiving, normal sale এবং manual stock adjustment।
Stock history অবশই রাখেত হেব। Owner product-wise movement ও adjustment দখেত পারেব।
Manual stock adjustment-এ reason mandatory। Damage-এর জন আলাদা module থাকেব না; 
পেয়াজেন stock adjustment বা business-approved sale flow ববহার করা হেব। Lost product-এর 
আলাদা tracking নই। Low-stock warning V1-এ নই।
১১
. Raw Material Inventory
Raw material এবং finished product সম্পূণ আলাদা inventory। Raw material-এর উদাহরণ কাপড় , 
button, thread ইতািদ। V1-এ raw material basic record-keeping-এর জন থাকেব। Production 
process track করা হেব না।
Fields:
Item Name.
Quantity.
Description.
Date.
Notes.
Purchase Cost — optional.
Raw material-এর unit system V1-এ থাকেব না। Fabric-এর meter/length calculation পেয়াজন নই; 
পেয়াজনীয় detail Description/Notes-এ রাখা যােব। Raw material manually add/adjust করা যােব এবং 
ভিবষেত module expand করা যােব।
১২
. Supplier Management
নতুন supplier create করা যােব। Supplier-wise কী কী কনা হেয়েছ, week/month-এ কত quantity কনা 
হেয়েছ, purchase history, payment history এবং current due দখা যােব।
Supplier fields:
Supplier ID.
Name.
Phone.
Address — optional.
Notes — optional.
Created/Updated date.
Supplier information ও supplier financial data Owner-only হেব।
১৩
. Purchase Management
একি purchase transaction-এর মেধ multiple items থাকেব। যমন একই supplier থেক fabric, 
button, thread একসােথ কনা।
Purchase data:
Purchase ID.
Supplier.
Purchase Date.
Multiple purchase items.
Item name.
Quantity.
Cost/amount where applicable.
Total purchase amount.
Paid amount.
Due amount.
Notes.
Receipt images — optional, multiple.
Purchase-এর payment partial হেত পাের। উদাহরণ: Total ৳20,000 → Paid ৳5,000 → Due 
৳15,000; পের ৳10,000 payment → Due ৳5,000। একািধক partial supplier payment supported 
হেব।
১৪
. Supplier Payment 
বনাম
 Cash — 
সম্পূণ
 
আলাদা
Critical rule: Supplier Payment এবং Cash Management-এর মেধ কােনা automatic 
relationship থাকেব না। Supplier payment record করেল supplier due কমেব, িক ু Cash Balance 
automaticভােব কমেব না।
Supplier ledger: Purchase → Supplier Payment(s) → Supplier Due
Cash ledger: Opening Cash → Cash In → Cash Out → Current Cash
Owner চাইেল আলাদা cash-out entry িদেত পাের, িক ু supplier payment system িনেজ থেক cash-out 
তির করেব না। এই দুই system V1-এ independent থাকেব।
১৫
. Supplier Receipt Images
Supplier purchase-এর physical receipt-এর ছিব proof িহেসেব upload করা যােব। একি purchase-এর 
সােথ একািধক image রাখা যােব। Production-এ image file database-এ সরাসির না রেখ secure 
object/cloud storage এবং database reference ববহার করা উত্তম।
১৬
. Expense Management
Shop-এর unusual/operating expense record করার জন Expense module থাকেব। Expense 
category owner পেয়াজন অনুযায়ী add করেত পারেব।
Expense fields:
Expense Category.
Amount.
Date — required.
Description — optional.
Notes — optional.
শুধু Owner expense add/view করেত পারেব। Employee expense দখেত বা add করেত পারেব না। 
Monthly এবং yearly expense report থাকেব।
১৭
. Cash Management
Cash module দাকােন physical cash-এর operational িহসাব রাখেব। িদেনর শুরেত opening cash input 
হেব। Previous day's closing cash → next day's opening cash হেব; Owner চাইেল adjust করেত 
পারেব।
Cash In: Owner বািড় থেক বা অন source থেক cash এেন দাকােন রাখেল manually input 
করেত পারেব। Customer normal sales cash flow িহসােবও cash record হেব।
Cash Out: দাকােনর cash থেক য amount বর হেব, amount ও reason record করেত হেব। 
ক remove কেরেছ সি ও audit field িহেসেব রাখা ভােলা। Supplier payment automatic 
cash-out নয়।
িদেনর শেষ Owner app-এর cash এবং physical cash িমিলেয় দখেব। আলাদা reconciliation/difference 
feature V1-এ নই।
১৮
. Profit Calculation
Profit optional। Owner profit দখেত চাইেল product-এর purchase price manually entered থাকেত 
হেব। Purchase price missing থাকেল profit show করা হেব না।
Basic formula:
Unit Profit = Selling Price − Purchase Price
Total Product Profit = Unit Profit × Quantity
Raw material, labour, production, rent, electricity বা অন indirect cost V1 product profit-এ ধরা 
হেব না।
১৯
. Dashboard
Dashboard intentionally simple থাকেব। Required metrics মাত্র চারি :
Today's Sales.
Today's Custom Orders.
Current Cash.
Total Stock Items.
Supplier due, profit, expense, monthly sales ইতািদ dashboard card িহেসেব থাকেব না; এগুেলা 
relevant owner-only modules/reports-এ থাকেব।
২০
. Reports
সব reports শুধু Owner দখেত পারেব।
Sales: Daily/Monthly/Yearly sales, product-wise sold quantity, sales history, 
Sales ID search।
Customer: Customer total purchase history, custom order history, outstanding 
custom-order due, custom-order payment history।
Inventory: Current stock, sold quantity, stock movement, stock adjustment 
history ও reason।
Supplier/Purchase: Supplier-wise history, weekly/monthly quantity, total 
purchase, payment history, current due।
Expense: Daily/monthly/yearly ও category-wise expense।
Cash: Opening cash, cash-in, cash-out, current cash।
Profit: Purchase price available থাকা records-এর জন। Missing purchase price-এর 
profit দখােনা হেব না।
২১
. Search Requirements
Customer: Customer ID, Name, Phone.
Product: Product ID, Product Name/Title.
Sales: Sales ID.
Supplier: Supplier ID, Name, Phone.
Product title descriptive হওয়ায় text search practical হেত হেব; যমন 'blue shirt 40' িলখেল 
matching products পাওয়া উিচত।
২২
. Date Rules
নতুন sale, purchase, expense ইতািদ current date অনুযায়ী create হেব; user ই ামেতা পুেরােনা date 
িদেয় নতুন transaction backdate করেত পারেব না। Customer ও child creation date system-এ 
সংরিক্ষত থাকেব। Child class increment-এর anchor হেব child-এর own creation date।
২৩
. Data Integrity 
ও
 Validation
Customer ID, Supplier ID, Product ID, Sales ID, Purchase ID unique হেব।
Normal sale-এ full payment required এবং due 0।
Custom order advance total-এর বিশ হেত পারেব না।
Custom order due = total − recorded payments।
Quantity 0/negative হেত পারেব না।
Selling price negative হেত পারেব না।
Purchase cost optional; থাকেল negative নয়।
Stock adjustment reason mandatory।
Cash-out amount ও reason mandatory।
Inactive product নতুন sale-এ select করা যােব না।
Available stock-এর বিশ normal sale করা যােব না।
Customer delete করা যােব না।
Historical transaction hard-delete না করাই উিচত।
২৪
. Proposed Database Entities
users — Owner/Employee authentication ও role.
customers — customer master.
children — customer-এর child records.
products — finished products.
sales — normal sale header.
sale_items — sale-এর products, quantity ও selling price.
custom_orders — custom order header.
custom_order_items — order-এর product/details.
custom_order_payments — advance/final/other payment history.
suppliers — supplier master.
purchases — purchase header.
purchase_items — purchase-এর multiple items.
supplier_payments — supplier payment ledger.
raw_materials — basic raw material inventory.
raw_material_movements — raw material stock history.
expenses — expense records.
expense_categories — owner-defined categories.
cash_transactions — opening/cash-in/cash-out.
stock_movements — finished-product stock movement history.
purchase_receipt_images — supplier receipt proof images.
২৫
. Data Relationships
Customer → Children: one-to-many, business limit 1–4.
Customer → Sales: one-to-many.
Sale → Sale Items: one-to-many.
Customer → Custom Orders: one-to-many.
Custom Order → Payments: one-to-many.
Supplier → Purchases: one-to-many.
Purchase → Purchase Items: one-to-many.
Supplier → Payments: one-to-many.
Product → Stock Movements: one-to-many.
Purchase → Receipt Images: one-to-many.
২৬
. Transaction Integrity
Normal sale confirm করার সময় sale header, sale items এবং stock decrease একই database 
transaction-এর মেধ save করা উিচত। Purchase-এর ক্ষেত্রও purchase, items ও inventory 
movement consistentভােব process করা উিচত। Custom-order payment save করার সময় payment 
history ও due update consistent রাখেত হেব।
এেত মাঝপেথ error হেল partial/inconsistent record তির হওয়ার স াবনা কেম।
২৭
. Security
Login authentication বাধতামূলক।
Password hash কের রাখেত হেব; plain text নয়।
Role-based authorization backend/API level-এ enforce করেত হেব।
Employee restricted data frontend-এ hide করার পাশাপািশ backend থেকও block করেত 
হেব।
Purchase cost, Supplier due/payment, Cash, Expense, Reports owner-only।
Supplier receipt image authorized user-এর জন সীিমত রাখেত হেব।
২৮
. Mobile-Responsive Requirement
Employee দাকােন mobile phone/tablet থেক দত sale করেব, তাই application mobile-first হওয়া 
উিচত। Sale screen-এ customer search, product search, quantity, price ও confirm action খুব 
কম step-এ সম্পন করা উিচত।
Responsive layout.
Fast product search & customer search.
Mobile-friendly sale cart.
Large, clear action buttons.
Owner reports mobile ও desktop উভেয়ই readable.
Mobile camera থেক supplier receipt image upload সহজ হওয়া।
২৯
. Proposed Main Screens
Owner: Login, Dashboard, Sales, Sales History, Custom Orders, Customers, 
Children, Products, Finished Inventory/Stock History, Raw Materials, Suppliers, 
Purchases, Supplier Payments, Expenses, Cash, Reports, Profile/Settings।
Employee: Sales, Customer Search/Basic Customer View এবং final workflow 
অনুযায়ী পেয়াজনীয় custom-order operational screen।
৩০
. Normal Sale Screen Flow
Customer Search → Customer Select/Create → Product Search → Product Select → 
Quantity → Selling Price → Cart → Total → Confirm Sale → Sales ID → Stock Update 
→ Success
৩১
. Custom Order Screen Flow
Customer Search/Create → Product/Description → Total Price → Advance → Due → 
Expected Delivery Date → Notes → Pending → Save → Later Payment → Ready → 
Delivered / Canceled
৩২
. Purchase Screen Flow
Supplier Search/Create → Multiple Items → Quantity/Cost → Total → Paid → Due → 
Receipt Images → Notes → Save Purchase → Later Supplier Payments
৩৩
. Child Auto Update — Technical Rule
Child creation date হেব yearly increment-এর anchor।
Example: 01 Sep 2026 Class 5 → 01 Sep 2027 Class 6 → 01 Sep 2028 Class 7 → 01 
Sep 2029 Class 8। App বন্ধ থাকেলও পের server-side check/scheduled job পেয়াজনীয় increment 
detect করেব।
৩৪
. Recommended Technology Stack
Backend: Node.js + Express.js
Frontend: React + Vite
Database: MySQL
ORM: Prisma
API: REST
Architecture: React Frontend → Express REST API → Prisma → MySQL
৩৫
. Development Phases
1. Phase 1 — Requirement finalization.
2. Phase 2 — Frontend screen structure, navigation ও user flow.
3. Phase 3 — Responsive UI prototype.
4. Phase 4 — Client UI approval.
5. Phase 5 — ER diagram ও final database schema.
6. Phase 6 — Node.js + Express + Prisma backend setup.
7. Phase 7 — Authentication ও role authorization.
8. Phase 8 — Customer + Children.
9. Phase 9 — Products + Finished Inventory.
10. Phase 10 — Normal Sales + Sales ID.
11. Phase 11 — Custom Orders + Payments.
12. Phase 12 — Suppliers + Purchases + Supplier Payments.
13. Phase 13 — Raw Materials.
14. Phase 14 — Expenses.
15. Phase 15 — Cash.
16. Phase 16 — Reports + Dashboard.
17. Phase 17 — Testing, security review ও deployment.
৩৬
. Final Business Rules — 
এক
 
নজের
Customer ID auto-generated.
Same customer phone → same account.
Customer delete করা যােব না, phone edit করা যােব.
Child ১–৪ জন, creation date থেক পিত বছর class +1 (12-এর পরও চলেব).
Product ID থাকেব, descriptive title (type/size/color আলাদা column নয়).
Default selling price নই, পিতবার manually input.
Purchase price optional, owner-only (না থাকেল profit show হেব না).
Normal sale full cash; customer due নই.
Partial payment শুধু custom order-এ (advance non-refundable).
Finished product ও raw material আলাদা.
Supplier payment ও cash ledger সম্পূণ াধীন/independent.
Physical receipt app generate করেব না; Sales ID িলেখ রাখা যােব.
৩৭
. V1 Acceptance Criteria
V1 complete ধরা হেব যখন Owner ও Employee িনজ িনজ permission অনুযায়ী login করেত পারেব; 
customer/child maintain করা যােব; child class automatic yearly update হেব; product ও 
finished stock manage হেব; normal sale full cash payment ও unique Sales ID সহ save হেব; 
physical receipt-এর Sales ID িদেয় history search করা যােব; custom order 
advance/due/status/payment history কাজ করেব; supplier purchase/partial payment/due কাজ 
করেব; raw material আলাদা থাকেব; expense ও cash owner-onlyভােব কাজ করেব; supplier payment 
cash ledger-ক automaticভােব affect করেব না; এবং owner required reports ও চারি dashboard 
metric দখেত পারেব।
৩৮
. Requirement Conclusion
NI Fashion-এর জন V1 একি lightweight িক ু structured shop management system হেব। 
Architecture-এর সবেচেয় গুর পূণ িতনি separation হেলা: Normal Sale 
বনাম
 Custom Order, 
Finished Product 
বনাম
 Raw Material Inventory, এবং Supplier Ledger 
বনাম
 Cash 
Ledger। এগুেলা database ও backend business logic-এ পির ারভােব maintain করেত হেব।
Next recommended step: আেগ Frontend Screen Structure + Navigation + User Flow + 
Wireframe/Prototype তির কের client approval নওয়া। এরপর approved flow অনুযায়ী ER Diagram 
ও final database schema তির করা হেব।
— End of NI Fashion V1 Requirement Analysis

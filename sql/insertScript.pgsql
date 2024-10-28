INSERT INTO "statusType" (statusTypeName)
values
    ('Available'),
    ('Archived'),
    ('Out for Repair'),
    ('Pending'),
    ('Lost/Stolen'),
    ('Active');

INSERT INTO "user" (
    userName, 
    isAdmin, 
    canRequest, 
    lastName, 
    firstName, 
    email, 
    lan, 
    password, 
    creation_date, 
    change_date
) VALUES
    ('userOne', FALSE, TRUE, 'Doe', 'John', 'john.doe@example.com', 'en', 'password123', '2024-01-01 00:00:00', NULL),
    ('userTwo', TRUE, FALSE, 'Smith', 'Jane', 'jane.smith@example.com', 'fr', 'password456', '2024-01-02 12:34:56', '2024-01-03 12:00:00'),
    ('userThree', FALSE, TRUE, 'Brown', 'Alex', 'alex.brown@example.com', 'es', 'password789', '2024-01-03 23:45:00', NULL);
   
INSERT INTO "user" (
    userName, 
    isAdmin, 
    canRequest, 
    lastName, 
    firstName, 
    email, 
    lan, 
    password, 
    change_date
) VALUES
    ('userFour', TRUE, TRUE, 'Adler', 'Irene', 'irene.adler@example.com', 'de', 'securePass1', NULL),
    ('userFive', FALSE, TRUE, 'Holmes', 'Sherlock', 'sherlock.holmes@example.com', 'en', 'securePass2', NULL),
    ('userSix', FALSE, FALSE, 'Watson', 'John', 'john.watson@example.com', 'fr', 'securePass3', NULL);
   
insert into "user"(    
	userName, 
    isAdmin, 
    canRequest, 
    lastName, 
    firstName, 
    email, 
    lan, 
    password, 
    change_date
) values
('a.boleslawski'),
('a.ludwig'),
('a.wiens'),
('a.galkin'),
('a.bothfeld'),
('b.siebert'),
('c.schulz'),
('d.kaiser'),
('f.schippel'),
('h.kallina'),
('h.griskewitz'),
('j.stoldt'),
('j.stallmeister'),
(''),
(''),
(''),
(''),
(''),
(''),
(''),
(''),
(''),

INSERT INTO "user" (userName, isAdmin, canRequest, lastName, firstName, email, lan, password, creation_date, change_date)
VALUES
('it', TRUE, TRUE, 'Admin', 'Admin', 'it@liganova-horizon.com', NULL, 'default_password', NOW(), NULL),
('a.boleslawski', FALSE, TRUE, 'Boleslawski', 'Agnes', 'a.boleslawski@liganova-horizon.com', 'DE', 'default_password', NOW(), NULL),
('a.ludwig', FALSE, TRUE, 'Ludwig', 'Alexander', 'a.ludwig@liganova-horizon.com', 'DE', 'default_password', NOW(), NULL),
('a.bothfeld', FALSE, TRUE, 'Haidari', 'Ali', 'a.haidari@liganova-horizon.com', 'DE', 'default_password', NOW(), NULL),
('a.wiens', FALSE, TRUE, 'Wiens', 'Andreas', 'a.wiens@liganova-horizon.com', 'DE', 'default_password', NOW(), NULL),
('a.galkin', FALSE, TRUE, 'Galkin', 'Andrii', 'a.galkin@liganova-horizon.com', 'EN', 'default_password', NOW(), NULL),
('b.siebert', FALSE, TRUE, 'Siebert', 'Benny', 'b.siebert@liganova-horizon.com', 'DE', '', NOW(), NULL),
('c.schulz', FALSE, TRUE, 'Schulz', 'Christine', 'c.schulz@liganova-horizon.com', 'DE', '', NOW(), NULL),
('d.kaiser', FALSE, TRUE, 'Kaiser', 'Daniel', 'd.kaiser@liganova-horizon.com', '', '', NOW(), NULL),
('f.schippel', FALSE, TRUE, 'Schippel', 'Franziska', 'f.schippel@liganova-horizon.com', 'DE', '', NOW(), NULL),
('h.kallina', FALSE, TRUE, 'Kallina', 'Hannes', 'h.kallina@liganova-horizon.com', 'DE', '', NOW(), NULL),
('h.griskewitz', FALSE, TRUE, 'Griskewitz', 'Heike', 'h.griskewitz@liganova-horizon.com', 'DE', '', NOW(), NULL),
('j.stoldt', FALSE, TRUE, 'Stoldt', 'Jesko', 'j.stoldt@liganova-horizon.com', 'DE', '', NOW(), NULL),
('j.stallmeister', FALSE, TRUE, 'Stallmeister', 'Jonas', 'j.stallmeister@liganova-horizon.com', 'DE', '', NOW(), NULL),
('k.michaelis', FALSE, TRUE, 'Michaelis', 'Klaus-Martin', 'k.michaelis@liganova-horizon.com', 'DE', '', NOW(), NULL),
('l.gerlich', TRUE, TRUE, 'Gerlich', 'Luca', 'l.gerlich@liganova-horizon.com', 'DE', '', NOW(), NULL),
('m.colloseus', FALSE, TRUE, 'Colloseus', 'Manuel', 'm.colloseus@liganova-horizon.com', 'DE', '', NOW(), NULL),
('m.schulz', FALSE, TRUE, 'Schulz', 'Marc', 'm.schulz@liganova-horizon.com', 'DE', '', NOW(), NULL),
('m.bavol', FALSE, TRUE, 'Bavol', 'Marika', 'm.bavol@liganova-horizon.com', 'DE', '', NOW(), NULL),
('m.schuhmacher', FALSE, TRUE, 'Schuhmacher', 'Markus', 'm.schuhmacher@liganova-horizon.com', 'DE', '', NOW(), NULL),
('m.novak-matulova', FALSE, TRUE, 'Novak-Matulova', 'Martina', 'm.novak-matulova@liganova-horizon.com', 'DE', '', NOW(), NULL),
('m.tuefekci', FALSE, TRUE, 'Tuefekci', 'Mete', 'm.tuefekci@liganova-horizon.com', 'DE', '', NOW(), NULL),
('m.laguardia', FALSE, TRUE, 'La-Guardia', 'Miquel', 'm.laguardia@liganova-horizon.com', 'DE', '', NOW(), NULL),
('m.vonbelow', TRUE, TRUE, 'Von-Below', 'Moritz', 'm.vonbelow@liganova-horizon.com', 'DE', '', NOW(), NULL),
('n.pulverich', FALSE, TRUE, 'Pulverich', 'Nicolai', 'n.pulverich@liganova-horizon.com', 'DE', '', NOW(), NULL),
('p.schneider', FALSE, TRUE, 'Schneider', 'Sophie', 'p.schneider@liganova-horizon.com', 'DE', '', NOW(), NULL),
('r.brittner', FALSE, TRUE, 'Brittner', 'Regina', 'r.brittner@liganova-horizon.com', 'DE', '', NOW(), NULL),
('r.georgi', TRUE, TRUE, 'Georgi', 'Robert', 'r.georgi@liganova-horizon.com', 'DE', '', NOW(), NULL),
('s.ledonne', FALSE, TRUE, 'Le-Donne', 'Sarah', 's.ledonne@liganova-horizon.com', 'DE', '', NOW(), NULL),
('s.kraus', FALSE, TRUE, 'Kraus', 'Sebastian', 's.kraus@liganova-horizon.com', 'DE', '', NOW(), NULL),
('s.sonnleitner', FALSE, TRUE, 'Sonnleitner', 'Sophie', 's.sonnleitner@liganova-horizon.com', 'DE', '', NOW(), NULL),
('m.klein', FALSE, TRUE, 'Klein', 'Maria', 'm.klei@liganova-horizon.com', 'DE', '', NOW(), NULL)

insert into "userAssets" (userid, assetid)
values ('8f631b33-e870-404f-b745-98056f386250','487005e9-86e6-48a6-a0b3-372f8dfbd035')
,('c391ce5b-a531-4051-b91c-e8826a7ea98a','579c63d1-f707-43a2-83de-f6f60edfcfad')
,('f15dfd9f-0a1b-4a3f-97a2-50deed6e78a8','a34f0887-2f1f-47e1-9fb3-79217e4ed6a8')
,('3cb5cfbb-1ee6-4a5f-8e09-8fa78a37751a','88999ef9-c8a5-4f07-a2c4-c8dacefef960')
,('0820bfe9-c7e9-4b24-9e75-85783e8863e4','cf2365c7-456c-4d38-b62e-73a5274615d9')
,('cd0327fc-594b-4d32-9ec6-2f379025e013','e62996dc-8539-4097-ba13-9f2ac3253b67')
,('7613b69e-5a69-4a3b-95fd-e6ec9f837d2d','228a2b3e-feca-4d16-9756-b4db55d2a81b')


INSERT INTO "assetCategoryType" (assetCategoryTypeName)
values
    ('Computer'),
    ('Laptop'),
    ('Smartphone'),
    ('Display'),
    ('Tablet'),
    ('Phone'),
    ('Printer');
   
   
INSERT INTO "manufacturer" (manufacturerName)
VALUES
    ('Apple Inc.'),
    ('Samsung Electronics'),
    ('Google LLC'),
    ('Microsoft Corporation'),
    ('Intel Corporation');
   
   -- Inserting sample data into the 'location' table
INSERT INTO "location" (locationName, street, houseNumber, city, country)
VALUES
    ('Frankfurt Office', 'Hanauer Landstraße', '184', 'Frankfurt', 'Germany'),
    ('Stuttgart Office', 'Herdweg', '59', 'Stuttgart', 'Germany'),
    ('Berlin Office', 'Potsdamer Straße', '77', 'Berlin', 'Germany'),
    ('Munich Office', 'Sendlinger Str.', '10', 'Munich', 'Germany'),
    ('Hamburg Office', 'Neuer Wall', '50', 'Hamburg', 'Germany');

   
   -- Inserting sample data into the 'supplier' table
INSERT INTO "supplier" (
    supplierName, 
    lastName, 
    firstName, 
    salutation, 
    email, 
    phoneNumber
)
VALUES
    ('Amazon', 'Bezos', 'Jeff', 'Mr.', 'jeff.bezos@amazon.com', '1234567890'),
    ('Cyberport', 'Schmidt', 'Hans', 'Mr.', 'hans.schmidt@cyberport.de', '2345678901'),
    ('Newegg', 'Chang', 'Fred', 'Mr.', 'fred.chang@newegg.com', '3456789012'),
    ('Apple', 'Cook', 'Tim', 'Mr.', 'tim@apple.com', '4567890123'),
    ('B&H Photo', 'Posner', 'Sam', 'Mr.', 'sam.posner@bhphoto.com', '5678901234');

INSERT INTO "model" (modelName, modelnumber)
VALUES
    ('MacBook Pro 13-inch', 'A2251'),
    ('MacBook Pro 15-inch', 'A1990'),
    ('MacBook Pro 16-inch', 'A2141'),
    ('iMac 24-inch', 'A2438'),
    ('iMac 27-inch', 'A2115'),
    ('MacBook Air', 'A2179'),
    ('Mac Mini', 'A1347'),
    ('iPad Pro', 'A2229'),
    ('iPhone 13 Pro', 'A2638'),
    ('iPhone 12', 'A2172'),
    ('Apple Watch Series 7', 'A2476'),
    ('MacBook Pro 14-inch', 'A2442'),
    ('iMac Pro', 'A1862'),
    ('MacBook Pro 13-inch', 'A2338'),
    ('MacBook Pro 16-inch', 'A2485'),
    ('MacBook Pro 15-inch', 'A1707'),
    ('iMac 27-inch', 'A2115'),
    ('iMac 24-inch', 'A2438'),
    ('iPad Air', 'A2316'),
    ('iPhone SE', 'A2275');
   
   insert into "model" (modelname, modelnumber)
   values ('Mac Pro', 'A1481');
   
   -- Inserting sample data into the 'asset' table
INSERT INTO "asset" (
    assetName,
    assetTag,
    serialnumber,
    modelID,
    specs,
    notes,
    purchasePrice,
    purchaseDate,
    mobile,
    requestable,
    AssetCategoryTypeID,
    statusTypeID,
    supplierID,
    locationID,
    manufacturerID
)
VALUES
    ('MacBook Pro 16-inch', 'MBP-001', 'SN001', '18cca5dc-32f8-4645-a82d-92495338e783', '16-inch, 16GB RAM, 1TB SSD', 'Needs battery replacement soon', 2400.00, '2021-01-10', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'b4cf2691-370f-491e-8765-cab33a2314d4', '205a30aa-6822-4a70-8d5b-959af9066b71', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
    ('iMac 24-inch', 'IMAC-024', 'SN002', 'fb35cde6-6bcf-43c9-ad89-8aab33683668', '24-inch, 8GB RAM, 256GB SSD', NULL, 1299.00, '2021-06-15', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', 'b4cf2691-370f-491e-8765-cab33a2314d4', '205a30aa-6822-4a70-8d5b-959af9066b71', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
    ('iPhone 13 Pro', 'IP13-005', 'SN003', 'd0783e23-fbe4-449b-96e5-e65ab05cd9c3', '6.1-inch, 128GB', 'Assigned to sales department', 799.00, '2022-03-03', TRUE, TRUE, '1c639b46-c105-45dc-bce8-445c529c29d9', 'b4cf2691-370f-491e-8765-cab33a2314d4', '205a30aa-6822-4a70-8d5b-959af9066b71', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
    ('iPad Air', 'IPADAIR-002', 'SN004', '77504131-3ca5-46a7-aafb-70b6369d50d2', '10.9-inch, 256GB', 'Used for client presentations', 599.00, '2022-05-21', TRUE, TRUE, 'fbb6ace5-2a3a-4e8f-9d81-f1abcd1cd4a7', 'b4cf2691-370f-491e-8765-cab33a2314d4', '205a30aa-6822-4a70-8d5b-959af9066b71', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
    ('Mac Mini', 'MMINI-007', 'SN005', '6b2bc731-bb26-4958-b97b-96599be719c3', 'M1 chip, 8GB RAM, 512GB SSD', NULL, 699.00, '2021-09-10', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', 'b4cf2691-370f-491e-8765-cab33a2314d4', '205a30aa-6822-4a70-8d5b-959af9066b71', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3');

   INSERT INTO "asset" (
    assetName,
    assetTag,
    serialnumber,
    modelID,
    specs,
    notes,
    purchasePrice,
    purchaseDate,
    mobile,
    requestable,
    AssetCategoryTypeID,
    statusTypeID,
    supplierID,
    locationID,
    manufacturerID
)
VALUES
    ('MacBook Pro 16-inch', 'MBP-002', 'SN006', '18cca5dc-32f8-4645-a82d-92495338e783', '16-inch, 16GB RAM, 1TB SSD', 'Needs battery replacement soon', 2400.00, '2021-01-10', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'b4cf2691-370f-491e-8765-cab33a2314d4', '205a30aa-6822-4a70-8d5b-959af9066b71', '13bad7c7-c8fc-4537-857b-5dd387987375', 'e524a92b-06a3-4457-8e06-004d8e91c0f3')
   
    
    INSERT INTO "asset" (
    assetName, 
    assetTag, 
    serialnumber, 
    modelID, 
    specs, 
    notes, 
    purchasePrice, 
    purchaseDate, 
    mobile, 
    requestable, 
    AssetCategoryTypeID, 
    statusTypeID, 
    SupplierID, 
    locationID, 
    manufacturerID
) VALUES
('MacBook Air 13"', 'MBA13-2024-001', 	'SN0007',  '5a4cc3d6-49b1-4be6-9c1e-347a166dad49', '13-inch, M1, 8GB RAM, 256GB SSD', 'For marketing department', 999.00, '2023-01-15', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'c11c2574-03cb-47ca-9adc-8ca3be94ca5e', '205a30aa-6822-4a70-8d5b-959af9066b71', '15b451ae-3bc1-483e-b5a1-86d12f8d7f01', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Air 13"', 'MBA13-2024-002', 	'SN0008',  '5a4cc3d6-49b1-4be6-9c1e-347a166dad49', '13-inch, M1, 8GB RAM, 512GB SSD', 'For sales department', 1199.00, '2023-01-16', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'c11c2574-03cb-47ca-9adc-8ca3be94ca5e', '205a30aa-6822-4a70-8d5b-959af9066b71', '15b451ae-3bc1-483e-b5a1-86d12f8d7f01', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Pro 16"', 'MBP16-2024-003', 	'SN0009',  '461b0ee3-f3d4-44f5-87ee-32b3ba46a461', '16-inch, M1 Pro, 16GB RAM, 512GB SSD', 'For design team', 2399.00, '2023-01-17', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', '1c4f0dd4-6a8c-496a-8e08-357fc922c026', '0759f08a-0976-4ec3-87c9-ba784b613c38', '15b451ae-3bc1-483e-b5a1-86d12f8d7f01', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('iMac 24"', 		'IM24-2024-004', 	'SN0010',  'fb35cde6-6bcf-43c9-ad89-8aab33683668', '24-inch, M1, 8GB RAM, 256GB SSD', 'For HR department', 1299.00, '2023-01-18', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', 'b4cf2691-370f-491e-8765-cab33a2314d4', '0759f08a-0976-4ec3-87c9-ba784b613c38', '15b451ae-3bc1-483e-b5a1-86d12f8d7f01', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('Mac Mini', 		'MM-2024-005', 		'SN0011',  '6b2bc731-bb26-4958-b97b-96599be719c3', 'M1, 8GB RAM, 256GB SSD', 'For finance department', 699.00, '2023-01-19', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', 'c11c2574-03cb-47ca-9adc-8ca3be94ca5e', '0759f08a-0976-4ec3-87c9-ba784b613c38', '15b451ae-3bc1-483e-b5a1-86d12f8d7f01', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Pro 14"', 'MBP14-2024-030', 	'SN0030',  '5c3ca522-7592-4489-a5e8-af0de4710530', '14-inch, M1 Pro, 16GB RAM, 1TB SSD', 'For executive team', 2999.00, '2023-01-30', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'b4cf2691-370f-491e-8765-cab33a2314d4', '0759f08a-0976-4ec3-87c9-ba784b613c38', 'eca35749-d666-4d1a-9f96-2743883ac3f8', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Air 13"', 'MBA13-2024-031',	'SN0031',  '5a4cc3d6-49b1-4be6-9c1e-347a166dad49',  '13-inch, M1, 8GB RAM, 256GB SSD', 'For remote work', 999.00, '2023-02-01', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', '1c4f0dd4-6a8c-496a-8e08-357fc922c026', '0759f08a-0976-4ec3-87c9-ba784b613c38', 'eca35749-d666-4d1a-9f96-2743883ac3f8', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Air 13"', 'MBA13-2024-032', 	'SN0032',  '5a4cc3d6-49b1-4be6-9c1e-347a166dad49', '13-inch, M1, 8GB RAM, 512GB SSD', 'For development team', 1199.00, '2023-02-02', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', '1c4f0dd4-6a8c-496a-8e08-357fc922c026', '0759f08a-0976-4ec3-87c9-ba784b613c38', '8b25adfe-bde3-4b7b-b9f5-46f15cf28181', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Pro 16"', 'MBP16-2024-033', 	'SN0033',  '461b0ee3-f3d4-44f5-87ee-32b3ba46a461', '16-inch, M1 Pro, 16GB RAM, 512GB SSD', 'For video editing', 2399.00, '2023-02-03', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', '1c4f0dd4-6a8c-496a-8e08-357fc922c026', '0759f08a-0976-4ec3-87c9-ba784b613c38', '8b25adfe-bde3-4b7b-b9f5-46f15cf28181', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Pro 16"', 'MBP16-2024-034', 	'SN0034',  '461b0ee3-f3d4-44f5-87ee-32b3ba46a461', '16-inch, M1 Pro, 32GB RAM, 1TB SSD', 'For graphics design', 2799.00, '2023-02-04', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', '1c4f0dd4-6a8c-496a-8e08-357fc922c026', '0759f08a-0976-4ec3-87c9-ba784b613c38', '8b25adfe-bde3-4b7b-b9f5-46f15cf28181', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Pro 13"', 'MBP13-2024-035', 	'SN0035',  'ea72fb7a-cfa1-4079-940a-f3890047fb0d', '13-inch, M1, 8GB RAM, 256GB SSD', 'For administration', 1299.00, '2023-02-05', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'b4cf2691-370f-491e-8765-cab33a2314d4', '205a30aa-6822-4a70-8d5b-959af9066b71', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('iMac 24"', 		'IM24-2024-036', 	'SN0036',  'fb35cde6-6bcf-43c9-ad89-8aab33683668', '24-inch, M1, 8GB RAM, 512GB SSD', 'For reception', 1499.00, '2023-02-06', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', 'b4cf2691-370f-491e-8765-cab33a2314d4', 'a14d48e0-f937-45b1-8a6c-c0956abddbbd', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('iMac 27"', 		'IM27-2024-037', 	'SN0037',  'fb35cde6-6bcf-43c9-ad89-8aab33683668', '27-inch, i7, 16GB RAM, 1TB SSD', 'For management', 1999.00, '2023-02-07', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', 'b4cf2691-370f-491e-8765-cab33a2314d4', '205a30aa-6822-4a70-8d5b-959af9066b71', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('Mac Mini', 		'MM-2024-038', 		'SN0038',  '6b2bc731-bb26-4958-b97b-96599be719c3', 'M1, 8GB RAM, 256GB SSD', 'For server use', 699.00, '2023-02-08', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', 'b4cf2691-370f-491e-8765-cab33a2314d4', 'a14d48e0-f937-45b1-8a6c-c0956abddbbd', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('Mac Pro', 		'MP-2024-059', 		'SN0059',  '5ea2ea5a-4f60-49d2-9ee0-7842e2481b6c', 'Intel Xeon W, 32GB RAM, 1TB SSD', 'For intensive computational tasks', 5999.00, '2023-02-24', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', 'b4cf2691-370f-491e-8765-cab33a2314d4', 'a14d48e0-f937-45b1-8a6c-c0956abddbbd', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Pro 14"', 'MBP14-2024-060',	'SN0060',  '5c3ca522-7592-4489-a5e8-af0de4710530', '14-inch, M1 Pro, 16GB RAM, 1TB SSD', 'For field research', 2999.00, '2023-03-01', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'b4cf2691-370f-491e-8765-cab33a2314d4', 'a14d48e0-f937-45b1-8a6c-c0956abddbbd', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Air 13"', 'MBA13-2024-1001',	'SN10001', '5a4cc3d6-49b1-4be6-9c1e-347a166dad49', '13-inch, M1, 8GB RAM, 256GB SSD', 'For general office use', 999.00, '2023-02-01', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'b4cf2691-370f-491e-8765-cab33a2314d4', '205a30aa-6822-4a70-8d5b-959af9066b71', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Air 13"', 'MBA13-2024-1002',	'SN10002', '5a4cc3d6-49b1-4be6-9c1e-347a166dad49', '13-inch, M1, 8GB RAM, 512GB SSD', 'For field agents', 1199.00, '2023-02-02', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'b4cf2691-370f-491e-8765-cab33a2314d4', 'a14d48e0-f937-45b1-8a6c-c0956abddbbd', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Pro 14"', 'MBP14-2024-1003',	'SN10003', '5c3ca522-7592-4489-a5e8-af0de4710530', '14-inch, M1 Pro, 16GB RAM, 512GB SSD', 'For developers', 1999.00, '2023-02-03', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'b4cf2691-370f-491e-8765-cab33a2314d4', 'a14d48e0-f937-45b1-8a6c-c0956abddbbd', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Pro 16"', 'MBP16-2024-1004',	'SN10004', '461b0ee3-f3d4-44f5-87ee-32b3ba46a461', '16-inch, M1 Max, 32GB RAM, 1TB SSD', 'For graphic designers', 3499.00, '2023-02-04', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'da2b51ed-406c-4f6b-9f87-90a102234bf4', 'a14d48e0-f937-45b1-8a6c-c0956abddbbd', '1be6a6a2-6ed5-4e79-81f3-25b3d72c6df9', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('iMac 24"', 		'IM24-2024-1005', 	'SN10005', 'fb35cde6-6bcf-43c9-ad89-8aab33683668', '24-inch, M1, 8GB RAM, 256GB SSD', 'For customer support', 1299.00, '2023-02-05', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', 'c24268d3-bcad-44b2-a5a5-025124a4b7f9', 'a14d48e0-f937-45b1-8a6c-c0956abddbbd', '13bad7c7-c8fc-4537-857b-5dd387987375', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('iMac 27"', 		'IM27-2024-1006', 	'SN10006', '9496ac79-7517-4060-875a-c6a4376636d6', '27-inch, i7, 16GB RAM, 512GB SSD', 'For video editing suite', 2299.00, '2023-02-06', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', 'b4cf2691-370f-491e-8765-cab33a2314d4', 'a14d48e0-f937-45b1-8a6c-c0956abddbbd', '13bad7c7-c8fc-4537-857b-5dd387987375', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('Mac Mini', 		'MM-2024-1007', 		'SN10007', '6b2bc731-bb26-4958-b97b-96599be719c3', 'M1, 16GB RAM, 512GB SSD', 'For software testing', 1099.00, '2023-02-07', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', '1c4f0dd4-6a8c-496a-8e08-357fc922c026', 'a14d48e0-f937-45b1-8a6c-c0956abddbbd', '13bad7c7-c8fc-4537-857b-5dd387987375', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('Mac Pro', 		'MP-2024-1008', 		'SN10008', '5ea2ea5a-4f60-49d2-9ee0-7842e2481b6c', 'Intel Xeon W, 32GB RAM, 1TB SSD', 'For 3D modeling', 5999.00, '2023-02-08', FALSE, TRUE, 'f9a22372-d0f6-448d-bb65-8bd4d51a911e', '1c4f0dd4-6a8c-496a-8e08-357fc922c026', 'a14d48e0-f937-45b1-8a6c-c0956abddbbd', '13bad7c7-c8fc-4537-857b-5dd387987375', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Pro 13"', 'MBP13-2024-1009', 	'SN10009', 'ea72fb7a-cfa1-4079-940a-f3890047fb0d', '13-inch, M1, 8GB RAM, 256GB SSD', 'For sales team', 1299.00, '2023-02-09', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'c24268d3-bcad-44b2-a5a5-025124a4b7f9', '205a30aa-6822-4a70-8d5b-959af9066b71', '13bad7c7-c8fc-4537-857b-5dd387987375', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Air 13"', 'MBA13-2024-1010', 	'SN10010', '5a4cc3d6-49b1-4be6-9c1e-347a166dad49', '13-inch, M1, 8GB RAM, 512GB SSD', 'Reserved for executives', 1199.00, '2023-02-10', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', '5251ee69-45eb-4585-9cc0-334fb8da14f1', '205a30aa-6822-4a70-8d5b-959af9066b71', '13bad7c7-c8fc-4537-857b-5dd387987375', 'e524a92b-06a3-4457-8e06-004d8e91c0f3'),
('MacBook Air 13"', 'MBA13-2024-1011', 	'SN10011', '5a4cc3d6-49b1-4be6-9c1e-347a166dad49', '13-inch, M1, 8GB RAM, 256GB SSD', 'For marketing department', 999.00, '2023-02-11', TRUE, TRUE, '6698eb78-d3d4-4cb0-9813-cda1cff689ab', 'da2b51ed-406c-4f6b-9f87-90a102234bf4', '205a30aa-6822-4a70-8d5b-959af9066b71', '13bad7c7-c8fc-4537-857b-5dd387987375', 'e524a92b-06a3-4457-8e06-004d8e91c0f3');

INSERT INTO "userAssets" (UserID, AssetId) VALUES
('b6276823-b99b-4310-ac29-54366de6d17b', 'e6f7b5d3-cd9d-4b28-bc43-4221e5f68617'),
('60a5f927-2cb1-4e8a-be02-ea737381b5cf', '228a2b3e-feca-4d16-9756-b4db55d2a81b'),
('1e6f3416-1b8e-4293-9036-2073824566b8', 'e4620e0a-b70e-4149-b520-d4944faa8a3f'),
('636b943f-2a4f-4d01-8d9c-912cdc18fc6a', 'bae79378-2b97-4f5d-9f83-45fa4089b1b1'),
('037671d0-c145-4e68-9c1d-da23dc95f5fe', '579c63d1-f707-43a2-83de-f6f60edfcfad'),
('8fc0bf38-4dac-4bf9-b907-50a1e7828f51', '487005e9-86e6-48a6-a0b3-372f8dfbd035'),
('b6276823-b99b-4310-ac29-54366de6d17b', 'cf2365c7-456c-4d38-b62e-73a5274615d9'),
('60a5f927-2cb1-4e8a-be02-ea737381b5cf', '88999ef9-c8a5-4f07-a2c4-c8dacefef960'),
('1e6f3416-1b8e-4293-9036-2073824566b8', 'a34f0887-2f1f-47e1-9fb3-79217e4ed6a8'),
('636b943f-2a4f-4d01-8d9c-912cdc18fc6a', 'e62996dc-8539-4097-ba13-9f2ac3253b67');
    
    
   select * from "statusType" st  
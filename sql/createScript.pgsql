-- USER TABELLE
-- Ein user kann mehrere Assets, Accessories und Lizenzen haben
CREATE TABLE "user" (
    userID UUID PRIMARY key default gen_random_uuid(),
    userName VARCHAR UNIQUE,
    isAdmin BOOLEAN NOT NULL,
    canRequest BOOLEAN NOT NULL,
    lastName VARCHAR NOT NULL,
    firstName VARCHAR NOT NULL,
    email VARCHAR UNIQUE,
    lan VARCHAR,
    password VARCHAR NOT NULL,
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL
);

-- LOCATION TABELLE
-- Locations sind da wo sich die Assets oder Accessories befinden
CREATE TABLE "location" (
    locationID UUID PRIMARY key default gen_random_uuid(),
    locationName VARCHAR,
    street VARCHAR,
    houseNumber VARCHAR,
    city VARCHAR,
    country VARCHAR,
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL
);

CREATE TABLE "manufacturer" (
    manufacturerID UUID PRIMARY key default gen_random_uuid(),
    manufacturerName VARCHAR NOT NULL,
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL
);

CREATE TABLE "model" (
    modelID UUID PRIMARY key default gen_random_uuid(),
    modelName VARCHAR NOT NULL,
    modelnumber VARCHAR,
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL
);

CREATE TABLE "supplier" (
    supplierID UUID PRIMARY key default gen_random_uuid(),
    supplierName VARCHAR NOT NULL,
    lastName VARCHAR,
    firstName VARCHAR,
    salutation VARCHAR,
    email VARCHAR,
    phoneNumber VARCHAR, 
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL
);

--TYPE TABELLEN
CREATE TABLE "statusType" (
    statusTypeID UUID PRIMARY key default gen_random_uuid(),
    statusTypeName VARCHAR NOT NULL
);

CREATE TABLE "assetCategoryType" (
    assetCategoryTypeID UUID PRIMARY key default gen_random_uuid(),
    assetCategoryTypeName VARCHAR NOT NULL
);

CREATE TABLE "accessorieCategoryType" (
    accessorieCategoryTypeID UUID PRIMARY key default gen_random_uuid(),
    accessorieCategoryTypeName VARCHAR NOT NULL
);

CREATE TABLE "licenceCategoryType" (
    licenceCategoryTypeID UUID PRIMARY key default gen_random_uuid(),
    licenceCategoryTypeName VARCHAR NOT NULL
);

CREATE TABLE "consumableCategoryType" (
    consumableCategoryTypeID UUID PRIMARY key default gen_random_uuid(),
    consumableCategoryTypeName VARCHAR NOT NULL
);

-- ASSET U ASSESSORIE TABELLEN
-- Ein Asset u ein Accessorie haben immer einen Status, einen Manufacturer, ein Model, eine category, ein supplier und eine Location
-- Ein Asset u ein Accessorie kann immer nur einem User zugeordnet sein
CREATE TABLE "asset" (
    assetID UUID PRIMARY key default gen_random_uuid(),
    assetName VARCHAR NOT NULL,
    assetTag VARCHAR UNIQUE NOT NULL,
    serialnumber VARCHAR UNIQUE NOT NULL,
    modelID UUID, 
    specs TEXT,
    notes TEXT,
    purchasePrice NUMERIC(10, 2),
    purchaseDate DATE,
    mobile BOOLEAN,
    requestable BOOLEAN,
    AssetCategoryTypeID UUID, 
	statusTypeID UUID, 
    SupplierID UUID, 
    locationID UUID,
    manufacturerID UUID,
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL,
    constraint fk_asset_location_c_locationID FOREIGN KEY (locationID) REFERENCES "location"(locationID), 
    constraint fk_asset_supplier_c_supplierID FOREIGN KEY (supplierID) REFERENCES "supplier" (supplierID), 
    constraint fk_asset_manufacturer_c_manufacturerID FOREIGN KEY (manufacturerID) REFERENCES "manufacturer" (manufacturerID),
    constraint fk_asset_statusType_c_statusTypeID FOREIGN KEY (statusTypeID) REFERENCES "statusType" (statusTypeID),
    constraint fk_asset_assetCategoryType_c_AssetCategoryTypeID FOREIGN KEY (AssetCategoryTypeID) REFERENCES "assetCategoryType"(AssetCategoryTypeID),
    constraint fk_asset_model_c_modelID FOREIGN KEY (modelID) REFERENCES "model" (modelID)
);

CREATE TABLE "accessories" (
    accessorieID UUID PRIMARY key default gen_random_uuid(),
    accessorieName VARCHAR NOT NULL,
    accessorieTag VARCHAR NOT NULL,
    purchasePrice NUMERIC(10, 2),
    purchaseDate DATE,
    requestable BOOLEAN,
    manufacturerID UUID NOT NULL, 
    statusTypeID UUID NOT NULL, 
    accessorieCategoryTypeID UUID NOT NULL,
    locationID UUID NOT NULL,
    supplierID UUID NOT NULL,
    modelID UUID NOT NULL,
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL,
    constraint fk_accessories_manufacturer_c_manufacturerID FOREIGN KEY (manufacturerID) REFERENCES "manufacturer" (manufacturerID),
    constraint fk_accessories_statusType_c_statusTypeID FOREIGN KEY (statusTypeID) REFERENCES "statusType" (statusTypeID),
    constraint fk_accessories_accessorieCategoryType_c_accessorieCategoryTypeID FOREIGN KEY (accessorieCategoryTypeID) REFERENCES "accessorieCategoryType"(accessorieCategoryTypeID),
    constraint fk_accessories_location_c_locationID FOREIGN KEY (locationID) REFERENCES "location"(locationID), 
    constraint fk_accessories_supplier_c_supplierID FOREIGN KEY (supplierID) REFERENCES "supplier" (supplierID), 
    constraint fk_accessories_model_c_modelID FOREIGN KEY (modelID) REFERENCES "model" (modelID)
);

-- CONSUMABLE TABELLE
-- Ein Consumable hat immer einen Manufacturer und einen supplier
-- Ein Consumable wird niemandem zugeordnet sein
CREATE TABLE "consumable" (
    consumableID UUID PRIMARY key default gen_random_uuid(),
    consumableName VARCHAR NOT NULL,
    consumableCategoryTypeID UUID NOT NULL, 
    manufacturerID UUID NOT NULL, 
    supplierID UUID NOT NULL,
    purchasePrice NUMERIC(10, 2),
    purchaseDate DATE,
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL,
    constraint fk_consumable_consumableCategoryType_c_consumableCategoryTypeID FOREIGN KEY (consumableCategoryTypeID) REFERENCES "consumableCategoryType"(consumableCategoryTypeID),
    constraint fk_consumable_manufacturer_c_manufacturerID FOREIGN KEY (manufacturerID) REFERENCES "manufacturer" (manufacturerID),
    constraint fk_consumable_supplier_c_supplierID FOREIGN KEY (supplierID) REFERENCES "supplier" (supplierID)
);

-- LIZENZ TABELLE
-- Eine Lizenz hat immer einen Supplier, einen Manufacturer
-- Eine Lizenz kann jemandem zugeordnet sein
CREATE TABLE "licence" (
    licenceID UUID PRIMARY key default gen_random_uuid(),
    licenceKey VARCHAR UNIQUE,
    licencedUserID UUID NULL, 
    licensedToEMail VARCHAR,
    purchasePrice NUMERIC(10, 2),
    purchaseDate DATE,
    expirationDate DATE,
    notes TEXT,
    requestable BOOLEAN,
    licenceCategoryTypeID UUID NOT NULL,
    manufacturerID UUID NOT NULL,
    supplierID UUID NOT NULL, 
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL,
    constraint fk_licence_supplier_c_supplierID FOREIGN KEY (supplierID) REFERENCES "supplier" (supplierID),
    constraint fk_licence_user_c_licencedUser_userID FOREIGN KEY (licencedUserID) REFERENCES "user"(userID),
    constraint fk_licence_licenceCategoryType_c_licenceCategoryTypeID FOREIGN KEY (licenceCategoryTypeID) REFERENCES "licenceCategoryType"(licenceCategoryTypeID),
    constraint fk_licence_manufacturer_c_manufacturerID FOREIGN KEY (manufacturerID) REFERENCES "manufacturer" (manufacturerID)
);

-- USER HAS TABELLEN
CREATE TABLE "userAssets" (
    userAssetsID UUID PRIMARY key default gen_random_uuid(),
    UserID UUID NOT NULL,
    AssetID UUID NOT NULL,
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL,
    constraint fk_userAssets_user_c_UserID FOREIGN KEY (userID) REFERENCES "user"(userID),
    constraint fk_userAssets_asset_c_AssetID FOREIGN KEY (assetID) REFERENCES "asset"(AssetID)
);

CREATE TABLE "userAccessoires" (
    userAccessoiresID UUID PRIMARY key default gen_random_uuid(),
    UserID UUID NOT NULL,
    accessorieID UUID NOT NULL,
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL,
    constraint fk_userAccessoires_user_c_UserID FOREIGN KEY (userID) REFERENCES "user"(userID),
    constraint fk_userAccessoires_accessories_c_accessorieID FOREIGN KEY (accessorieID) REFERENCES "accessories"(accessorieID)
);

-- HISTORIE TABELLEN
CREATE TABLE "userHistory" (
    historyID UUID PRIMARY key default gen_random_uuid(),
    referenceID UUID,
    referenceTable varchar(20),
    UserID UUID NOT NULL,
    actionName VARCHAR NOT NULL,
    updateDate DATE,
    checkedOut DATE,
    checkedIn DATE,
    creation_date TIMESTAMP NOT NULL,
    change_date TIMESTAMP NULL,
    constraint check_userHistory_ReferenceTable check (ReferenceTable IN ('userAssets','userAccessoires')),
    constraint fk_userHistory_user_c_UserID FOREIGN KEY (UserID) REFERENCES "user"(userID)
	);
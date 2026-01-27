-- Asset Tracker Database Schema
-- This script creates all necessary tables for the Asset Tracker application

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- User Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "user" (
    userID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userName VARCHAR UNIQUE,
    isAdmin BOOLEAN NOT NULL,
    canRequest BOOLEAN NOT NULL,
    lastName VARCHAR NOT NULL,
    firstName VARCHAR NOT NULL,
    email VARCHAR UNIQUE,
    lan VARCHAR,
    password VARCHAR NOT NULL,
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL
);

-- ===========================================
-- Location Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "location" (
    locationID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    locationName VARCHAR,
    street VARCHAR,
    houseNumber VARCHAR,
    city VARCHAR,
    country VARCHAR,
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL
);

-- ===========================================
-- Manufacturer Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "manufacturer" (
    manufacturerID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturerName VARCHAR NOT NULL,
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL
);

-- ===========================================
-- Model Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "model" (
    modelID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modelName VARCHAR NOT NULL,
    modelnumber VARCHAR,
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL
);

-- ===========================================
-- Supplier Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "supplier" (
    supplierID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplierName VARCHAR NOT NULL,
    lastName VARCHAR,
    firstName VARCHAR,
    salutation VARCHAR,
    email VARCHAR,
    phoneNumber VARCHAR,
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL
);

-- ===========================================
-- Type Tables
-- ===========================================
CREATE TABLE IF NOT EXISTS "statusType" (
    statusTypeID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statusTypeName VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS "assetCategoryType" (
    assetCategoryTypeID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assetCategoryTypeName VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS "accessorieCategoryType" (
    accessorieCategoryTypeID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accessorieCategoryTypeName VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS "licenceCategoryType" (
    licenceCategoryTypeID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    licenceCategoryTypeName VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS "consumableCategoryType" (
    consumableCategoryTypeID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumableCategoryTypeName VARCHAR NOT NULL
);

-- ===========================================
-- Asset Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "asset" (
    assetID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL,
    CONSTRAINT fk_asset_location_c_locationID FOREIGN KEY (locationID) REFERENCES "location"(locationID),
    CONSTRAINT fk_asset_supplier_c_supplierID FOREIGN KEY (supplierID) REFERENCES "supplier"(supplierID),
    CONSTRAINT fk_asset_manufacturer_c_manufacturerID FOREIGN KEY (manufacturerID) REFERENCES "manufacturer"(manufacturerID),
    CONSTRAINT fk_asset_statusType_c_statusTypeID FOREIGN KEY (statusTypeID) REFERENCES "statusType"(statusTypeID),
    CONSTRAINT fk_asset_assetCategoryType_c_AssetCategoryTypeID FOREIGN KEY (AssetCategoryTypeID) REFERENCES "assetCategoryType"(AssetCategoryTypeID),
    CONSTRAINT fk_asset_model_c_modelID FOREIGN KEY (modelID) REFERENCES "model"(modelID)
);

-- ===========================================
-- Accessories Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "accessories" (
    accessorieID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL,
    CONSTRAINT fk_accessories_manufacturer_c_manufacturerID FOREIGN KEY (manufacturerID) REFERENCES "manufacturer"(manufacturerID),
    CONSTRAINT fk_accessories_statusType_c_statusTypeID FOREIGN KEY (statusTypeID) REFERENCES "statusType"(statusTypeID),
    CONSTRAINT fk_accessories_accessorieCategoryType_c_accessorieCategoryTypeID FOREIGN KEY (accessorieCategoryTypeID) REFERENCES "accessorieCategoryType"(accessorieCategoryTypeID),
    CONSTRAINT fk_accessories_location_c_locationID FOREIGN KEY (locationID) REFERENCES "location"(locationID),
    CONSTRAINT fk_accessories_supplier_c_supplierID FOREIGN KEY (supplierID) REFERENCES "supplier"(supplierID),
    CONSTRAINT fk_accessories_model_c_modelID FOREIGN KEY (modelID) REFERENCES "model"(modelID)
);

-- ===========================================
-- Consumable Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "consumable" (
    consumableID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumableName VARCHAR NOT NULL,
    consumableCategoryTypeID UUID NOT NULL,
    manufacturerID UUID NOT NULL,
    supplierID UUID NOT NULL,
    purchasePrice NUMERIC(10, 2),
    purchaseDate DATE,
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL,
    CONSTRAINT fk_consumable_consumableCategoryType_c_consumableCategoryTypeID FOREIGN KEY (consumableCategoryTypeID) REFERENCES "consumableCategoryType"(consumableCategoryTypeID),
    CONSTRAINT fk_consumable_manufacturer_c_manufacturerID FOREIGN KEY (manufacturerID) REFERENCES "manufacturer"(manufacturerID),
    CONSTRAINT fk_consumable_supplier_c_supplierID FOREIGN KEY (supplierID) REFERENCES "supplier"(supplierID)
);

-- ===========================================
-- Licence Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "licence" (
    licenceID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL,
    CONSTRAINT fk_licence_supplier_c_supplierID FOREIGN KEY (supplierID) REFERENCES "supplier"(supplierID),
    CONSTRAINT fk_licence_user_c_licencedUser_userID FOREIGN KEY (licencedUserID) REFERENCES "user"(userID),
    CONSTRAINT fk_licence_licenceCategoryType_c_licenceCategoryTypeID FOREIGN KEY (licenceCategoryTypeID) REFERENCES "licenceCategoryType"(licenceCategoryTypeID),
    CONSTRAINT fk_licence_manufacturer_c_manufacturerID FOREIGN KEY (manufacturerID) REFERENCES "manufacturer"(manufacturerID)
);

-- ===========================================
-- User Assets Junction Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "userAssets" (
    userAssetsID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    UserID UUID NOT NULL,
    AssetID UUID NOT NULL UNIQUE,
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL,
    CONSTRAINT fk_userAssets_user_c_UserID FOREIGN KEY (userID) REFERENCES "user"(userID),
    CONSTRAINT fk_userAssets_asset_c_AssetID FOREIGN KEY (assetID) REFERENCES "asset"(AssetID)
);

-- ===========================================
-- User Accessories Junction Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "userAccessoires" (
    userAccessoiresID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    UserID UUID NOT NULL,
    accessorieID UUID NOT NULL,
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL,
    CONSTRAINT fk_userAccessoires_user_c_UserID FOREIGN KEY (userID) REFERENCES "user"(userID),
    CONSTRAINT fk_userAccessoires_accessories_c_accessorieID FOREIGN KEY (accessorieID) REFERENCES "accessories"(accessorieID)
);

-- ===========================================
-- User History Table
-- ===========================================
CREATE TABLE IF NOT EXISTS "userHistory" (
    historyID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referenceID UUID,
    referenceTable VARCHAR(20),
    actionName VARCHAR NOT NULL,
    updateDate DATE,
    checkedOut DATE,
    checkedIn DATE,
    creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    change_date TIMESTAMP NULL,
    CONSTRAINT check_userHistory_ReferenceTable CHECK (ReferenceTable IN ('userAssets', 'userAccessoires'))
);

-- ===========================================
-- Insert Default Status Types
-- ===========================================
INSERT INTO "statusType" (statusTypeName)
SELECT statusTypeName FROM (
    VALUES 
        ('Available'),
        ('Active'),
        ('Archived'),
        ('Out for Repair'),
        ('Pending'),
        ('Lost/Stolen')
) AS v(statusTypeName)
WHERE NOT EXISTS (SELECT 1 FROM "statusType");

COMMIT;

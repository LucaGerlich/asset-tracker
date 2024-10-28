CREATE TABLE "user" (
    userID UUID PRIMARY KEY,
    userName VARCHAR UNIQUE,
    isAdmin BOOLEAN NOT NULL,
    canRequest BOOLEAN NOT NULL,
    lastName VARCHAR NOT NULL,
    firstName VARCHAR NOT NULL,
    email VARCHAR UNIQUE,
    lan VARCHAR,
    password VARCHAR NOT NULL,
    creation_date TIMESTAMP NOT NULL
);

CREATE TABLE "groupType" (
    groupTypeID UUID PRIMARY KEY,
    groupTypeName VARCHAR NOT NULL
);

CREATE TABLE "groupMembers" (
    groupMembersID UUID PRIMARY KEY
);

CREATE TABLE "project" (
    projectID UUID PRIMARY KEY,
    projectName VARCHAR NOT NULL,
    projectDescription TEXT,
    projectStartDate DATE,
    projectEndDate DATE,
    projectStatus VARCHAR,
    projectManager VARCHAR NOT NULL
);

CREATE TABLE "projectMembers" (
    projectMembersID UUID PRIMARY KEY,
);

CREATE TABLE "location" (
    locationID UUID PRIMARY KEY,
    locationName VARCHAR,
    street VARCHAR,
    houseNumber VARCHAR,
    city VARCHAR,
    country VARCHAR,
    --fk_user_id BIGSERIAL REFERENCES "user"(id)
);

CREATE TABLE "manufacturer" (
    manufacturerID UUID PRIMARY KEY,
    manufacturerName VARCHAR NOT NULL
);

CREATE TABLE "model" (
    modelID UUID PRIMARY KEY,
    modelName VARCHAR NOT NULL,
    modelnumber VARCHAR,
    --fk_manufacturer_id UUID REFERENCES "manufacturer"(id)
);

CREATE TABLE "assetCategoryType" (
    assetCategoryTypeID UUID PRIMARY KEY,
    assetCategoryType INT NOT NULL,
    manufacturerName VARCHAR NOT NULL
);

CREATE TABLE "statusType" (
    statusTypeID UUID PRIMARY KEY,
    statustyp INT NOT NULL,
    statusTypeName VARCHAR NOT NULL
);

CREATE TABLE "accessorieCategoryType" (
    accessorieCategoryTypeID UUID PRIMARY KEY,
    accessorieCategoryType INT NOT NULL,
    accessorieCategoryTypeName VARCHAR NOT NULL
);

CREATE TABLE "licenceCategoryType" (
    licenceCategoryTypeID UUID PRIMARY KEY,
    licenceCategoryType INT NOT NULL,
    licenceCategoryTypeName VARCHAR NOT NULL
);

CREATE TABLE "consumableCategoryType" (
    consumableCategoryTypeID BIGSERIAL PRIMARY KEY,
    consumableCategoryType INT NOT NULL,
    consumableCategoryTypeName VARCHAR NOT NULL,
);

CREATE TABLE "supplier" (
    supplierID UUID PRIMARY KEY,
    supplierName VARCHAR NOT NULL,
    lastName VARCHAR,
    firstName VARCHAR,
    salutation VARCHAR,
    email VARCHAR,
    phoneNumber NUMERIC(12, 0),
);

CREATE TABLE "consumable" (
    consumableID UUID PRIMARY KEY,
    consumableName VARCHAR NOT NULL,
    category VARCHAR NOT NULL, --FK
    manufacturer VARCHAR, --FK
    purchasePrice NUMERIC(10, 2),
    purchaseDate DATE
);

CREATE TABLE "accessories" (
    accessorieID UUID PRIMARY KEY,
    accessorieName VARCHAR NOT NULL,
    accessorieTag VARCHAR NOT NULL,
    manufacturer VARCHAR NOT NULL, --FK
    purchasePrice NUMERIC(10, 2),
    purchaseDate DATE,
    requestable BOOLEAN,
    statusTypeID INT, --FK
    --fk_user_id UUID REFERENCES "user"(id),
    --fk_manufacturer_id UUID REFERENCES "manufacturer"(id),
    --fk_model_id UUID REFERENCES "model"(id)
);

CREATE TABLE "licence" (
    licenceID UUID PRIMARY KEY,
    suppliersName VARCHAR,
    licenceKey VARCHAR UNIQUE,
    licensedToName VARCHAR,
    licensedToEMail VARCHAR,
    purchasePrice NUMERIC(10, 2),
    purchaseDate DATE,
    expirationDate DATE,
    notes TEXT,
    requestable BOOLEAN,
    -- fk_user_id UUID REFERENCES "user"(id)
);

CREATE TABLE "asset" (
    assetID UUID PRIMARY KEY,
    assetName VARCHAR NOT NULL,
    assetTag VARCHAR UNIQUE NOT NULL,
    serialnumber VARCHAR UNIQUE NOT NULL,
    modelnumber VARCHAR,
    specs TEXT,
    notes TEXT,
    purchasePrice NUMERIC(10, 2),
    purchaseDate DATE,
    creationDate TIMESTAMP NOT NULL,
    mobile BOOLEAN,
    requestable BOOLEAN,
    categoryTypeID INT,
	statusTypeID INT,
    SupplierID INT,
    -- fk_user_id UUID REFERENCES "user"(id),
    -- fk_location_id UUID REFERENCES "location"(id),
    -- fk_supplier_id UUID REFERENCES "suppliers"(id),
    -- fk_manufacturer_id UUID REFERENCES "manufacturer"(id),
    -- fk_category_id UUID REFERENCES "category"(id),
    -- fk_model_id UUID REFERENCES "model"(id),
    -- fk_status_id UUID REFERENCES "status"(id)
);

CREATE TABLE "projectAssets" (
    projectAssetsID UUID PRIMARY KEY,
    --fk_project_id UUID REFERENCES "project"(id),
    --fk_user_id UUID REFERENCES "user"(id)
);

CREATE TABLE "projectAccessoires" (
    projectAccessoiresID UUID PRIMARY KEY,
    --fk_project_id UUID REFERENCES "project"(id),
    --fk_user_id UUID REFERENCES "user"(id)
);

CREATE TABLE "userAssets" (
    userAssetsID UUID PRIMARY KEY,
    --UserID BIGSERIAL REFERENCES "user"(id),
    --AssetID BIGSERIAL REFERENCES "asset"(id),
);

CREATE TABLE "userAccessoires" (
    userAccessoiresID UUID PRIMARY KEY,
    --UserID BIGSERIAL REFERENCES "user"(id),
    --accessoriesID BIGSERIAL REFERENCES "accessories"(id),
);

CREATE TABLE "userHistory" (
    historyID UUID PRIMARY KEY,
    actionName VARCHAR NOT NULL,
    --UserID BIGSERIAL REFERENCES "user"(id),
    --licenceID BIGSERIAL REFERENCES "licence"(id),
    updateDate DATE,
    CheckedOut DATE,
    CheckedIn DATE
);
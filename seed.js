// const { PrismaClient } = require("@prisma/client");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require("fs");
const path = require("path");

const directoryPath = "./all_locations_json_files"; // specify directory path here

function sanitizeStreetName(name) {
  return name.replace(/[^a-zA-Z ]/g, "").trim();
}

async function main() {
  const files = fs
    .readdirSync(directoryPath)
    .filter((file) => path.extname(file) === ".json");
  const missingStreets = [];

  for (const file of files) {
    const data = JSON.parse(
      fs.readFileSync(path.join(directoryPath, file), "utf8")
    );

    for (const locationData of data) {
      const location = await prisma.Location.create({
        data: {
          name: locationData.name,
          neighborhood: locationData.neighborhood,
          priorityStatus: locationData.priorityStatus,
          Street: {
            create: locationData.streets.map((streetName) => ({
              name: streetName,
            })),
          },
        },
        include: {
          Street: true,
        },
      });

      for (const houseData of locationData.houses) {
        const streetName = sanitizeStreetName(houseData.street);
        const street = location.Street.find(
          (s) => sanitizeStreetName(s.name) === streetName
        );

        if (!street) {
          missingStreets.push({
            location: location.name,
            streetName,
          });
          continue;
        }

        await prisma.house.create({
          data: {
            streetNumber: houseData.streetNumber
              ? parseInt(houseData.streetNumber, 10)
              : 0, // Default to 0 if not provided
            lastName: houseData.lastName,
            name: houseData.name,
            email: houseData.email,
            phone: houseData.phone,
            notes: houseData.notes,
            statusAttempt: houseData.statusAttempt,
            consent: houseData.consent,
            type: houseData.type,
            Street: {
              connect: {
                id: street.id,
              },
            },
            Location: {
              connect: {
                id: location.id,
              },
            },
          },
        });
      }
    }
  }
  handleMissingStreets(missingStreets);
  console.log("> Data has been seeded!");
}

function handleMissingStreets(missingStreets) {
  if (missingStreets.length === 0) {
    console.log("> 100% of Streets were found.\n>");
    return;
  }

  console.warn(
    "The following streets were not found in their respective locations:"
  );
  for (const { location, streetName } of missingStreets) {
    console.warn(`- Street ${streetName} not found in location ${location}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
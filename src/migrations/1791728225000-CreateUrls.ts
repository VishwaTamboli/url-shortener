import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUrls1791728225000 implements MigrationInterface {
  name = 'CreateUrls1791728225000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "urls" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "shortCode" character varying(10) NOT NULL, "originalUrl" text NOT NULL, "clicks" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_urls" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "urls" ADD CONSTRAINT "UQ_urls_shortCode" UNIQUE ("shortCode")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_urls_shortCode" ON "urls" ("shortCode")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_urls_shortCode"`);
    await queryRunner.query(`ALTER TABLE "urls" DROP CONSTRAINT IF EXISTS "UQ_urls_shortCode"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "urls"`);
  }
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('urls')
export class Url {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 10, unique: true })
  shortCode: string;

  @Column({ type: 'text' })
  originalUrl: string;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

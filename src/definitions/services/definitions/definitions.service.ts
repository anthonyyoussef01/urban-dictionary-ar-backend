import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Definition } from '../../../typeorm/entities/definition';
import { Repository, DeleteResult, UpdateResult } from 'typeorm';
import { CreateDefinitionDto } from '../../dtos/create-definition.dto';
import { UpdateDefinitionDto } from '../../dtos/update-definition.dto';
import { User } from '../../../typeorm/entities/user';

@Injectable()
export class DefinitionsService {
  constructor(
    @InjectRepository(Definition)
    private definitionsRepository: Repository<Definition>,
  ) {}

  async getDefinitions(): Promise<Definition[]> {
    return this.definitionsRepository.find();
  }

  async getMostLikedDefinitions(): Promise<any[]> {
    const ret = await this.definitionsRepository.query(`
        WITH RankedDefinitions AS (
            SELECT
                definition.definition,
                definition.likeCount,
                definition.dislikeCount,
                (definition.likeCount - definition.dislikeCount) AS likeDislikeDifference,
                definition.isArabic,
                word.id AS wordId,
                CASE
                    WHEN definition.isArabic = 1 THEN word.arabicWord
                    ELSE word.francoArabicWord
                    END AS word,
                word.reportCount AS wordReportCount,
                definition.reportCount AS definitionReportCount,
                ROW_NUMBER() OVER(PARTITION BY word.id, definition.isArabic ORDER BY (definition.likeCount - definition.dislikeCount) DESC) AS RowNum
            FROM
                definitions AS definition
                    LEFT JOIN
                words AS word ON definition.wordId = word.id
            WHERE
                word.reportCount <= 5 AND definition.reportCount <= 5
        )
        SELECT
            wordId,
            definition,
            likeCount,
            dislikeCount,
            likeDislikeDifference,
            isArabic,
            word,
            wordReportCount,
            definitionReportCount
        FROM
            RankedDefinitions
        WHERE
            RowNum = 1
        ORDER BY
            likeDislikeDifference DESC;
    `);

    return ret;
  }

  async getDefinitionById(id: number): Promise<Definition> {
    return this.definitionsRepository.findOne({
      where: { id },
    });
  }

  async createDefinition(
    user: User,
    createDefinitionDto: CreateDefinitionDto,
  ): Promise<Definition> {
    const newDefinition =
      this.definitionsRepository.create(createDefinitionDto);
    newDefinition.user = user;
    return this.definitionsRepository.save(newDefinition);
  }

  async updateDefinitionById(
    user: User,
    id: number,
    updateDefinitionDto: UpdateDefinitionDto,
  ): Promise<UpdateResult> {
    const definition = await this.getDefinitionById(id);

    if (!definition) {
      throw new HttpException('Definition not found', HttpStatus.NOT_FOUND);
    }
    if (definition.userId !== user.id) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    return this.definitionsRepository.update(id, updateDefinitionDto);
  }

  async deleteDefinitionById(user: User, id: number): Promise<DeleteResult> {
    const definition = await this.definitionsRepository.findOne({
      where: { id },
    });

    if (!definition) {
      throw new HttpException('Definition not found', HttpStatus.NOT_FOUND);
    }
    if (definition.userId !== user.id) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    return this.definitionsRepository.delete(id);
  }
}

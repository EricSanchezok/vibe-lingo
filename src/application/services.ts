import { VibeLingoDatabase, defaultDatabase } from "../infrastructure/database"
import { LearningRepository } from "../infrastructure/learning-repository"
import { ReviewRepository } from "../infrastructure/review-repository"
import { PatternPresentationRepository } from "../infrastructure/pattern-presentation-repository"
import { CorrectionRepository } from "../infrastructure/correction-repository"
import { PatternPresentationService } from "./presentation-service"
import { ReviewService } from "./review-service"
import { TranslationRepository } from "../infrastructure/translation-repository"
import { TranslationService } from "./translation-service"

export type VibeLingoServices = {
  database: VibeLingoDatabase
  learning: LearningRepository
  reviews: ReviewRepository
  reviewService: ReviewService
  presentations: PatternPresentationRepository
  corrections: CorrectionRepository
  presentationService: PatternPresentationService
  translations: TranslationRepository
  translationService: TranslationService
}

let singleton: VibeLingoServices | undefined

export function createServices(database: VibeLingoDatabase): VibeLingoServices {
  const learning = new LearningRepository(database)
  const reviews = new ReviewRepository(database, learning)
  const presentations = new PatternPresentationRepository(database)
  const translations = new TranslationRepository(database)
  return {
    database,
    learning,
    reviews,
    reviewService: new ReviewService(learning, reviews),
    presentations,
    corrections: new CorrectionRepository(database),
    presentationService: new PatternPresentationService(learning, presentations),
    translations,
    translationService: new TranslationService(translations),
  }
}

export function defaultServices(): VibeLingoServices {
  singleton ??= createServices(defaultDatabase())
  return singleton
}

export function closeDefaultServices(): void {
  singleton?.translationService.clearMemory()
  singleton?.database.close()
  singleton = undefined
}

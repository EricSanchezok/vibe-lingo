import { VibeLingoDatabase, defaultDatabase } from "../infrastructure/database"
import { LearningRepository } from "../infrastructure/learning-repository"
import { ReviewRepository } from "../infrastructure/review-repository"
import { ReviewService } from "./review-service"

export type VibeLingoServices = {
  database: VibeLingoDatabase
  learning: LearningRepository
  reviews: ReviewRepository
  reviewService: ReviewService
}

let singleton: VibeLingoServices | undefined

export function createServices(database: VibeLingoDatabase): VibeLingoServices {
  const learning = new LearningRepository(database)
  const reviews = new ReviewRepository(database, learning)
  return {
    database,
    learning,
    reviews,
    reviewService: new ReviewService(learning, reviews),
  }
}

export function defaultServices(): VibeLingoServices {
  singleton ??= createServices(defaultDatabase())
  return singleton
}

export function closeDefaultServices(): void {
  singleton?.database.close()
  singleton = undefined
}


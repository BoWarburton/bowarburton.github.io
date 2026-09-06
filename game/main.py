import math
import random
import sys
import asyncio
import pygame

# Initialize Pygame
pygame.init()

# Screen dimensions
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Retro Tank Shooter")

# Colors
DARK_BG = (25, 25, 25)
GRID_LINE = (35, 35, 35)

PLAYER_GREEN = (46, 139, 87)
PLAYER_DARK = (25, 80, 50)
ENEMY_RED = (180, 40, 40)
ENEMY_DARK = (100, 20, 20)

TRACK_GRAY = (40, 40, 40)
BULLET_YELLOW = (255, 220, 50)
WHITE = (240, 240, 240)
HEALTH_GREEN = (50, 205, 50)
HEALTH_RED = (200, 50, 50)

# Clock and FPS
clock = pygame.time.Clock()
FPS = 60

# Fonts
font = pygame.font.SysFont("arial", 22, bold=True)
large_font = pygame.font.SysFont("arial", 48, bold=True)


def create_tank_surface(main_color, dark_color, width=40, height=36):
  """Renders a detailed retro tank onto a transparent Surface."""
  surf = pygame.Surface((width, height), pygame.SRCALPHA)

  # Tread Tracks (Top and Bottom)
  track_h = 7
  pygame.draw.rect(surf, TRACK_GRAY, (0, 0, width - 4, track_h), border_radius=2)
  pygame.draw.rect(
      surf, TRACK_GRAY, (0, height - track_h, width - 4, track_h), border_radius=2
  )

  # Tread Segments Detail
  for x in range(3, width - 6, 6):
    pygame.draw.line(surf, (15, 15, 15), (x, 0), (x, track_h - 1), 1)
    pygame.draw.line(
        surf, (15, 15, 15), (x, height - track_h), (x, height - 1), 1
    )

  # Main Hull Body
  body_rect = pygame.Rect(4, track_h - 1, width - 10, height - (track_h * 2) + 2)
  pygame.draw.rect(surf, dark_color, body_rect, border_radius=3)
  pygame.draw.rect(
      surf,
      main_color,
      body_rect.inflate(-4, -4),
      border_radius=2,
  )

  # Cannon Barrel (Extends past the front right)
  barrel_rect = pygame.Rect(width // 2, (height // 2) - 3, (width // 2) + 6, 6)
  pygame.draw.rect(surf, (30, 30, 30), barrel_rect, border_radius=1)

  # Central Turret Dome
  turret_radius = 8
  center = (width // 2 - 2, height // 2)
  pygame.draw.circle(surf, dark_color, center, turret_radius)
  pygame.draw.circle(surf, main_color, center, turret_radius - 2)

  return surf


# Pre-render Tank Graphics
PLAYER_SURF = create_tank_surface(PLAYER_GREEN, PLAYER_DARK)
ENEMY_SURF = create_tank_surface(ENEMY_RED, ENEMY_DARK)


class PlayerTank:

  def __init__(self, x, y):
    self.x = x
    self.y = y
    self.speed = 3.2
    self.angle = 0  # 0 degrees = facing right
    self.turn_speed = 4
    self.health = 100
    self.max_health = 100
    self.radius = 18

  def update(self, keys):
    # Rotate Tank
    if keys[pygame.K_a]:
      self.angle += self.turn_speed
    if keys[pygame.K_d]:
      self.angle -= self.turn_speed

    # Drive Forward / Backward
    rad = math.radians(self.angle)
    if keys[pygame.K_w]:
      self.x += math.cos(rad) * self.speed
      self.y -= math.sin(rad) * self.speed
    if keys[pygame.K_s]:
      self.x -= math.cos(rad) * (self.speed * 0.5)
      self.y += math.sin(rad) * (self.speed * 0.5)

    # Screen boundary collision
    self.x = max(self.radius, min(WIDTH - self.radius, self.x))
    self.y = max(self.radius, min(HEIGHT - self.radius, self.y))

  def draw(self, surface):
    # Rotate the pre-rendered tank sprite
    rotated_surf = pygame.transform.rotate(PLAYER_SURF, self.angle)
    rect = rotated_surf.get_rect(center=(int(self.x), int(self.y)))
    surface.blit(rotated_surf, rect)

    # Overhead Health Bar
    bar_w, bar_h = 32, 5
    bar_x = self.x - bar_w // 2
    bar_y = self.y - 28
    pygame.draw.rect(
        surface, HEALTH_RED, (bar_x, bar_y, bar_w, bar_h), border_radius=2
    )
    current_w = max(0, int(bar_w * (self.health / self.max_health)))
    pygame.draw.rect(
        surface, HEALTH_GREEN, (bar_x, bar_y, current_w, bar_h), border_radius=2
    )

  def shoot(self):
    rad = math.radians(self.angle)
    barrel_offset = 24
    start_x = self.x + math.cos(rad) * barrel_offset
    start_y = self.y - math.sin(rad) * barrel_offset
    return Bullet(start_x, start_y, self.angle)


class Bullet:

  def __init__(self, x, y, angle):
    self.x = x
    self.y = y
    self.speed = 9.0
    self.angle = angle
    self.radius = 4

  def update(self):
    rad = math.radians(self.angle)
    self.x += math.cos(rad) * self.speed
    self.y -= math.sin(rad) * self.speed

  def draw(self, surface):
    pygame.draw.circle(
        surface, BULLET_YELLOW, (int(self.x), int(self.y)), self.radius
    )


class Enemy:

  def __init__(self):
    edge = random.choice(["top", "bottom", "left", "right"])
    if edge == "top":
      self.x, self.y = random.randint(0, WIDTH), -20
    elif edge == "bottom":
      self.x, self.y = random.randint(0, WIDTH), HEIGHT + 20
    elif edge == "left":
      self.x, self.y = -20, random.randint(0, HEIGHT)
    else:
      self.x, self.y = WIDTH + 20, random.randint(0, HEIGHT)

    self.speed = random.uniform(1.2, 2.0)
    self.angle = 0
    self.radius = 16

  def update(self, target_x, target_y):
    dx = target_x - self.x
    dy = target_y - self.y
    dist = math.hypot(dx, dy)

    if dist != 0:
      self.x += (dx / dist) * self.speed
      self.y += (dy / dist) * self.speed
      # Calculate angle facing towards the player
      self.angle = math.degrees(math.atan2(-dy, dx))

  def draw(self, surface):
    rotated_surf = pygame.transform.rotate(ENEMY_SURF, self.angle)
    rect = rotated_surf.get_rect(center=(int(self.x), int(self.y)))
    surface.blit(rotated_surf, rect)


def draw_grid_background(surface):
  surface.fill(DARK_BG)
  grid_size = 40
  for x in range(0, WIDTH, grid_size):
    pygame.draw.line(surface, GRID_LINE, (x, 0), (x, HEIGHT))
  for y in range(0, HEIGHT, grid_size):
    pygame.draw.line(surface, GRID_LINE, (0, y), (WIDTH, y))


# Game setup
player = PlayerTank(WIDTH // 2, HEIGHT // 2)
bullets = []
enemies = []

score = 0
spawn_timer = 0
spawn_interval = 50
game_over = False

async def main():
  global player, score, spawn_timer, game_over

  while True:
    clock.tick(FPS)

    for event in pygame.event.get():
      if event.type == pygame.QUIT:
        pygame.quit()
        sys.exit()

      if event.type == pygame.KEYDOWN:
        if event.key == pygame.K_SPACE and not game_over:
          bullets.append(player.shoot())
        if event.key == pygame.K_r and game_over:
          player = PlayerTank(WIDTH // 2, HEIGHT // 2)
          bullets.clear()
          enemies.clear()
          score = 0
          game_over = False

    if not game_over:
      keys = pygame.key.get_pressed()
      player.update(keys)

      # Spawn enemies
      spawn_timer += 1
      if spawn_timer >= spawn_interval:
        enemies.append(Enemy())
        spawn_timer = 0

      # Update bullets
      for bullet in bullets[:]:
        bullet.update()
        if (
            bullet.x < 0
            or bullet.x > WIDTH
            or bullet.y < 0
            or bullet.y > HEIGHT
        ):
          bullets.remove(bullet)

      # Update enemies & check collisions
      for enemy in enemies[:]:
        enemy.update(player.x, player.y)

        # Bullet hits enemy
        for bullet in bullets[:]:
          if math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < (
              bullet.radius + enemy.radius
          ):
            if bullet in bullets:
              bullets.remove(bullet)
            if enemy in enemies:
              enemies.remove(enemy)
            score += 10
            break

        # Enemy hits player
        if math.hypot(player.x - enemy.x, player.y - enemy.y) < (
            player.radius + enemy.radius
        ):
          player.health -= 20
          if enemy in enemies:
            enemies.remove(enemy)
          if player.health <= 0:
            player.health = 0
            game_over = True

    # Rendering
    draw_grid_background(screen)

    if not game_over:
      for bullet in bullets:
        bullet.draw(screen)
      for enemy in enemies:
        enemy.draw(screen)
      player.draw(screen)

      # HUD
      score_surf = font.render(f"Score: {score}", True, WHITE)
      health_surf = font.render(f"Health: {player.health}", True, WHITE)
      screen.blit(score_surf, (15, 12))
      screen.blit(health_surf, (160, 12))
    else:
      go_surf = large_font.render("GAME OVER", True, ENEMY_RED)
      final_score = font.render(f"Final Score: {score}", True, WHITE)
      restart_surf = font.render("Press 'R' to Restart", True, BULLET_YELLOW)

      screen.blit(go_surf, (WIDTH // 2 - 130, HEIGHT // 2 - 60))
      screen.blit(final_score, (WIDTH // 2 - 70, HEIGHT // 2))
      screen.blit(restart_surf, (WIDTH // 2 - 100, HEIGHT // 2 + 40))

    pygame.display.flip()
    await asyncio.sleep(0)


asyncio.run(main())
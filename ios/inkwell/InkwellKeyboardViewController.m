#import "InkwellKeyboardViewController.h"
#import <React/RCTEventEmitter.h>

@interface InkwellKeyboard : RCTEventEmitter
@end

@interface InkwellKeyboardViewController ()
@property (nonatomic, copy) NSArray<UIKeyCommand *> *feedKeyCommands;
- (void)updateFeedKeyCommands;
@end

static __weak InkwellKeyboard *activeKeyboard;
static __weak InkwellKeyboardViewController *keyboardController;
static NSString *const feedKeyEvent = @"inkwellFeedKeyCommand";

@implementation InkwellKeyboard

RCT_EXPORT_MODULE(InkwellKeyboard)

- (NSArray<NSString *> *)supportedEvents
{
  return @[feedKeyEvent];
}

- (void)startObserving
{
  dispatch_async(dispatch_get_main_queue(), ^{
    activeKeyboard = self;
    [keyboardController updateFeedKeyCommands];
  });
}

- (void)stopObserving
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (activeKeyboard == self) {
      activeKeyboard = nil;
      [keyboardController updateFeedKeyCommands];
    }
  });
}

@end

@implementation InkwellKeyboardViewController

- (void)viewDidAppear:(BOOL)animated
{
  [super viewDidAppear:animated];
  keyboardController = self;
  [self updateFeedKeyCommands];
}

- (UIKeyCommand *)feedKeyCommand:(NSString *)input
                      modifiers:(UIKeyModifierFlags)modifiers
                        command:(NSString *)command
                          title:(NSString *)title
{
  return [UIKeyCommand commandWithTitle:title
                                  image:nil
                                 action:@selector(handleFeedKeyCommand:)
                                  input:input
                          modifierFlags:modifiers
                           propertyList:command];
}

- (void)updateFeedKeyCommands
{
  if (activeKeyboard && self.feedKeyCommands.count == 0) {
    self.feedKeyCommands = @[
      [self feedKeyCommand:UIKeyInputUpArrow modifiers:0 command:@"up" title:@"Previous Post"],
      [self feedKeyCommand:UIKeyInputDownArrow modifiers:0 command:@"down" title:@"Next Post"],
      [self feedKeyCommand:@"1" modifiers:UIKeyModifierCommand command:@"today" title:@"Today"],
      [self feedKeyCommand:@"2" modifiers:UIKeyModifierCommand command:@"recent" title:@"Recent"],
      [self feedKeyCommand:@"3" modifiers:UIKeyModifierCommand command:@"fading" title:@"Fading"],
      [self feedKeyCommand:@"f" modifiers:UIKeyModifierCommand command:@"search" title:@"Search"],
      [self feedKeyCommand:@"n" modifiers:UIKeyModifierCommand command:@"new_post" title:@"New Post"],
      [self feedKeyCommand:@"b" modifiers:UIKeyModifierCommand | UIKeyModifierShift command:@"toggle_bookmark" title:@"Toggle Bookmark"],
      [self feedKeyCommand:@"u" modifiers:UIKeyModifierCommand | UIKeyModifierShift command:@"toggle_read" title:@"Toggle Read Status"],
      [self feedKeyCommand:@"\r" modifiers:0 command:@"open_web" title:@"Open on Web"],
    ];
    for (UIKeyCommand *command in self.feedKeyCommands) {
      [self addKeyCommand:command];
    }
  } else if (!activeKeyboard) {
    for (UIKeyCommand *command in self.feedKeyCommands) {
      [self removeKeyCommand:command];
    }
    self.feedKeyCommands = nil;
  }
}

- (BOOL)canPerformAction:(SEL)action withSender:(id)sender
{
  if (action == @selector(handleFeedKeyCommand:)) {
    return activeKeyboard != nil && self.presentedViewController == nil;
  }
  return [super canPerformAction:action withSender:sender];
}

- (void)handleFeedKeyCommand:(UIKeyCommand *)command
{
  [activeKeyboard sendEventWithName:feedKeyEvent body:@{@"command": command.propertyList}];
}

@end

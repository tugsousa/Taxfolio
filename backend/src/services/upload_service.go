package services

import (
	"TAXFOLIO/src/models"
	"TAXFOLIO/src/parsers"
	"TAXFOLIO/src/processors"
	"fmt"
	"io"
	"strings"
)

// uploadServiceImpl implements the UploadService interface.
type uploadServiceImpl struct {
	csvParser             parsers.CSVParser
	transactionProcessor  parsers.TransactionProcessor
	dividendProcessor     processors.DividendProcessor
	stockProcessor        processors.StockProcessor
	optionProcessor       processors.OptionProcessor
	cashMovementProcessor processors.CashMovementProcessor // Added

	// Store the latest result and the transactions that generated it
	latestResult                *UploadResult
	latestRawTransactions       []models.RawTransaction       // Added to store raw transactions
	latestProcessedTransactions []models.ProcessedTransaction // Added to store transactions
}

// NewUploadService creates a new instance of UploadService with its dependencies.
func NewUploadService(
	csvParser parsers.CSVParser,
	transactionProcessor parsers.TransactionProcessor,
	dividendProcessor processors.DividendProcessor,
	stockProcessor processors.StockProcessor,
	optionProcessor processors.OptionProcessor,
	cashMovementProcessor processors.CashMovementProcessor, // Added
) UploadService {
	return &uploadServiceImpl{
		csvParser:             csvParser,
		transactionProcessor:  transactionProcessor,
		dividendProcessor:     dividendProcessor,
		stockProcessor:        stockProcessor,
		optionProcessor:       optionProcessor,
		cashMovementProcessor: cashMovementProcessor, // Added
	}
}

// ProcessUpload handles the core logic of parsing the file and processing transactions.
func (s *uploadServiceImpl) ProcessUpload(fileReader io.Reader) (*UploadResult, error) {
	// 1. Parse CSV file
	rawTransactions, err := s.csvParser.Parse(fileReader)
	if err != nil {
		return nil, fmt.Errorf("error parsing csv file: %w", err)
	}

	// 2. Process RawTransaction into ProcessedTransaction
	processedTransactions, err := s.transactionProcessor.Process(rawTransactions)
	if err != nil {
		// Consider if this should be a different error type/status if it happens
		return nil, fmt.Errorf("error processing raw transactions: %w", err)
	}

	// 3. Calculate dividends
	dividendResult := s.dividendProcessor.Calculate(processedTransactions)

	// 4. Process stock transactions
	stockSaleDetails, stockHoldings := s.stockProcessor.Process(processedTransactions)

	// 5. Process option transactions
	optionSaleDetails, optionHoldings := s.optionProcessor.Process(processedTransactions)

	// 6. Process cash movements
	cashMovements := s.cashMovementProcessor.Process(processedTransactions) // Added

	// 7. Aggregate results (renumbered)
	result := &UploadResult{
		DividendResult:    dividendResult,
		StockSaleDetails:  stockSaleDetails,
		StockHoldings:     stockHoldings,
		OptionSaleDetails: optionSaleDetails,
		OptionHoldings:    optionHoldings,
		CashMovements:     cashMovements, // Added
	}

	// Store the latest result and transactions before returning
	s.latestResult = result
	s.latestRawTransactions = rawTransactions             // Store the raw transactions
	s.latestProcessedTransactions = processedTransactions // Store the transactions

	return result, nil
}

// GetLatestUploadResult returns the most recently processed upload result.
func (s *uploadServiceImpl) GetLatestUploadResult() (*UploadResult, error) {
	if s.latestResult == nil {
		// Return an error if no upload has been processed yet, matching the handler's expectation
		return nil, fmt.Errorf("no upload result available yet")
	}
	return s.latestResult, nil
}

// GetDividendTaxSummary calculates and returns the dividend summary specifically for tax reporting.
func (s *uploadServiceImpl) GetDividendTaxSummary() (models.DividendTaxResult, error) {
	if s.latestProcessedTransactions == nil {
		// Return an empty result or an error if no upload has been processed yet
		// Returning an error is likely better here to indicate no data is available.
		return nil, fmt.Errorf("no upload processed yet, cannot generate dividend tax summary")
	}

	// Use the stored transactions to calculate the tax summary
	taxSummary := s.dividendProcessor.CalculateTaxSummary(s.latestProcessedTransactions)

	return taxSummary, nil
}

// GetDividendTransactions retrieves the list of individual dividend transactions from the latest upload.
func (s *uploadServiceImpl) GetDividendTransactions() ([]models.ProcessedTransaction, error) {
	if s.latestProcessedTransactions == nil {
		// Return an error if no upload has been processed yet
		return nil, fmt.Errorf("no upload processed yet, cannot retrieve dividend transactions")
	}

	dividends := []models.ProcessedTransaction{}
	for _, tx := range s.latestProcessedTransactions {
		// Assuming OrderType "dividend" identifies dividend transactions (case-insensitive check is safer)
		if tx.OrderType != "" && strings.ToLower(tx.OrderType) == "dividend" {
			dividends = append(dividends, tx)
		}
	}

	return dividends, nil
}

// GetRawTransactions retrieves the list of raw transactions from the latest upload.
func (s *uploadServiceImpl) GetRawTransactions() ([]models.RawTransaction, error) {
	if s.latestRawTransactions == nil {
		// Return an error if no upload has been processed yet
		return nil, fmt.Errorf("no upload processed yet, cannot retrieve raw transactions")
	}
	return s.latestRawTransactions, nil
}

// GetProcessedTransactions retrieves the list of all processed transactions from the latest upload.
func (s *uploadServiceImpl) GetProcessedTransactions() ([]models.ProcessedTransaction, error) {
	if s.latestProcessedTransactions == nil {
		// Return an error if no upload has been processed yet
		return nil, fmt.Errorf("no upload processed yet, cannot retrieve processed transactions")
	}
	return s.latestProcessedTransactions, nil
}

// GetStockHoldings retrieves the current stock holdings from the latest upload.
func (s *uploadServiceImpl) GetStockHoldings() ([]models.PurchaseLot, error) {
	if s.latestResult == nil {
		return nil, fmt.Errorf("no upload processed yet, cannot retrieve stock holdings")
	}
	return s.latestResult.StockHoldings, nil
}

// GetOptionHoldings retrieves the current option holdings from the latest upload.
func (s *uploadServiceImpl) GetOptionHoldings() ([]models.OptionHolding, error) {
	if s.latestResult == nil {
		return nil, fmt.Errorf("no upload processed yet, cannot retrieve option holdings")
	}
	return s.latestResult.OptionHoldings, nil
}
